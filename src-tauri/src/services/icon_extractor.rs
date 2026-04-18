use std::ffi::OsStr;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::path::PathBuf;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::UI::WindowsAndMessaging::*;
use windows::Win32::UI::Shell::*;

/// Get the full exe path for a running process by its process name (e.g. "CHROME.EXE").
pub fn get_exe_path_for_process(process_name: &str) -> Option<String> {
    use windows::Win32::System::Diagnostics::ToolHelp::*;
    use windows::Win32::System::Threading::*;
    use windows::core::PWSTR;

    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W::default();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut found_pid = None;
        if Process32FirstW(snap, &mut entry as *mut _).is_ok() {
            loop {
                let end = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                let name = std::ffi::OsString::from_wide(&entry.szExeFile[..end])
                    .to_string_lossy()
                    .to_string();
                if name.eq_ignore_ascii_case(process_name) {
                    found_pid = Some(entry.th32ProcessID);
                    break;
                }
                if Process32NextW(snap, &mut entry as *mut _).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snap);
        let pid = found_pid?;

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 520];
        let mut len: u32 = 260;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT::default(),
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(handle);

        if result.is_ok() {
            let path = std::ffi::OsString::from_wide(&buf[..len as usize]);
            Some(path.to_string_lossy().into_owned())
        } else {
            None
        }
    }
}

/// Extract the icon from an exe file and save as PNG.
/// Returns the path where the PNG was saved.
pub fn extract_icon_to_png(exe_path: &str, output_dir: &str, app_id: i64) -> Result<String, String> {
    use std::fs;

    let dir = PathBuf::from(output_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("Create icon dir: {}", e))?;

    let output_path = dir.join(format!("{}.png", app_id));

    unsafe {
        let exe_wide: Vec<u16> = OsStr::new(exe_path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let icon = ExtractIconW(HINSTANCE::default(), windows::core::PCWSTR(exe_wide.as_ptr()), 0);
        if icon.is_invalid() || icon.0.is_null() {
            return Err("No icon found in exe".into());
        }

        let mut icon_info = ICONINFO::default();
        GetIconInfo(icon, &mut icon_info).map_err(|e| format!("GetIconInfo: {}", e))?;

        let mut bmp = BITMAP::default();
        GetObjectA(
            icon_info.hbmColor,
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut BITMAP as *mut _),
        );

        let width = bmp.bmWidth;
        let height = bmp.bmHeight;

        let hdc_screen = GetDC(None);

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bits = vec![0u8; (width * height * 4) as usize];

        let color_dc = CreateCompatibleDC(hdc_screen);
        let _ = SelectObject(color_dc, icon_info.hbmColor);
        GetDIBits(
            color_dc,
            icon_info.hbmColor,
            0,
            height as u32,
            Some(bits.as_mut_ptr() as *mut _),
            &mut bmi as *mut BITMAPINFO,
            DIB_RGB_COLORS,
        );

        let mut mask_bits = vec![0u8; (width * height * 4) as usize];
        let mask_dc = CreateCompatibleDC(hdc_screen);
        let _ = SelectObject(mask_dc, icon_info.hbmMask);
        GetDIBits(
            mask_dc,
            icon_info.hbmMask,
            0,
            height as u32,
            Some(mask_bits.as_mut_ptr() as *mut _),
            &mut bmi as *mut BITMAPINFO,
            DIB_RGB_COLORS,
        );

        for i in 0..(width * height) as usize {
            let base = i * 4;
            if bits[base + 3] == 0 && mask_bits[base] == 0 {
                bits[base] = 0;
                bits[base + 1] = 0;
                bits[base + 2] = 0;
                bits[base + 3] = 0;
            } else if bits[base + 3] == 0 {
                bits[base + 3] = 255;
            }
            let b = bits[base];
            let r = bits[base + 2];
            bits[base] = r;
            bits[base + 2] = b;
        }

        let _ = DeleteDC(color_dc);
        let _ = DeleteDC(mask_dc);
        let _ = ReleaseDC(None, hdc_screen);
        let _ = DeleteObject(icon_info.hbmColor);
        let _ = DeleteObject(icon_info.hbmMask);
        let _ = DestroyIcon(icon);

        let png_data = encode_png(width as u32, height as u32, &bits)?;

        fs::write(&output_path, png_data)
            .map_err(|e| format!("Write PNG: {}", e))?;
    }

    Ok(output_path.to_string_lossy().into_owned())
}

fn encode_png(width: u32, height: u32, rgba: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    let mut ihdr_data = Vec::new();
    ihdr_data.extend_from_slice(&width.to_be_bytes());
    ihdr_data.extend_from_slice(&height.to_be_bytes());
    ihdr_data.push(8);
    ihdr_data.push(6);
    ihdr_data.push(0);
    ihdr_data.push(0);
    ihdr_data.push(0);
    write_chunk(&mut out, b"IHDR", &ihdr_data);

    let mut raw = Vec::new();
    for y in 0..height {
        raw.push(0);
        let row_start = (y * width * 4) as usize;
        let row_end = row_start + (width * 4) as usize;
        raw.extend_from_slice(&rgba[row_start..row_end]);
    }

    let mut zlib = Vec::new();
    zlib.push(0x78);
    zlib.push(0x01);

    let data = &raw;
    let mut offset = 0;
    while offset < data.len() {
        let remaining = data.len() - offset;
        let block_size = remaining.min(65535);
        let is_last = offset + block_size >= data.len();

        zlib.push(if is_last { 0x01 } else { 0x00 });
        zlib.extend_from_slice(&(block_size as u16).to_le_bytes());
        zlib.extend_from_slice(&(block_size as u16 ^ 0xFFFF).to_le_bytes());
        zlib.extend_from_slice(&data[offset..offset + block_size]);
        offset += block_size;
    }

    let checksum = adler32(data);
    zlib.extend_from_slice(&checksum.to_be_bytes());

    write_chunk(&mut out, b"IDAT", &zlib);
    write_chunk(&mut out, b"IEND", &[]);

    Ok(out)
}

fn write_chunk(out: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(&(data.len() as u32).to_be_bytes());
    out.extend_from_slice(chunk_type);
    out.extend_from_slice(data);

    let mut crc_data = Vec::new();
    crc_data.extend_from_slice(chunk_type);
    crc_data.extend_from_slice(data);
    let crc = crc32(&crc_data);
    out.extend_from_slice(&crc.to_be_bytes());
}

fn crc32(data: &[u8]) -> u32 {
    let mut table = [0u32; 256];
    for i in 0..256 {
        let mut c = i as u32;
        for _ in 0..8 {
            if c & 1 != 0 {
                c = 0xEDB88320 ^ (c >> 1);
            } else {
                c >>= 1;
            }
        }
        table[i] = c;
    }

    let mut crc = 0xFFFFFFFFu32;
    for &byte in data {
        crc = table[((crc ^ byte as u32) & 0xFF) as usize] ^ (crc >> 8);
    }
    !crc
}

fn adler32(data: &[u8]) -> u32 {
    let mut a: u32 = 1;
    let mut b: u32 = 0;
    for &byte in data {
        a = (a + byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}
