Set-Location 'D:\Project\scene-todo'
Remove-Item -Path 'git-push.ps1' -ErrorAction SilentlyContinue
git reset HEAD git-push.ps1
Remove-Item -Path 'git-push.ps1' -ErrorAction SilentlyContinue
git add -A
git commit -m "style: normalize line endings from CRLF to LF" -m "Claude Code normalized line endings across all source files during the fix process. No functional changes."
git push origin master
