use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use windows::core::PWSTR;

pub fn get_process_name_from_hwnd(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
        PROCESS_NAME_FORMAT,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;
    use windows::Win32::Foundation::CloseHandle;

    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 260];
        let mut len: u32 = 260;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT::default(),
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(handle);

        if result.is_ok() {
            let path = OsString::from_wide(&buf[..len as usize]);
            let path_str = path.to_string_lossy();
            path_str.rsplit('\\').next().map(|s| s.to_uppercase())
        } else {
            None
        }
    }
}

pub fn get_window_title(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextLengthW, GetWindowTextW};

    unsafe {
        let len = GetWindowTextLengthW(hwnd);
        if len == 0 {
            return None;
        }

        let mut buf = vec![0u16; (len + 1) as usize];
        GetWindowTextW(hwnd, &mut buf);
        let title = OsString::from_wide(&buf[..len as usize]);
        Some(title.to_string_lossy().into_owned())
    }
}

pub fn get_window_rect(
    hwnd: windows::Win32::Foundation::HWND,
) -> Option<(i32, i32, i32, i32)> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

    unsafe {
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        Some((
            rect.left,
            rect.top,
            rect.right - rect.left,
            rect.bottom - rect.top,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_name_from_current_window() {
        let hwnd =
            unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
        let name = get_process_name_from_hwnd(hwnd);
        println!("Current foreground process: {:?}", name);
    }

    #[test]
    fn test_get_window_rect_current() {
        let hwnd =
            unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
        let rect = get_window_rect(hwnd);
        println!("Foreground window rect: {:?}", rect);
    }
}
