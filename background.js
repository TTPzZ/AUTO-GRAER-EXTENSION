// Background service worker
// Hiện tại tính năng kiểm tra cập nhật (Update Checker) đã được gỡ bỏ theo yêu cầu của user.
// Có thể thêm các tính năng chạy nền khác vào đây trong tương lai.

chrome.runtime.onInstalled.addListener(() => {
  console.log("MindX Auto Grader Extension installed.");
});
