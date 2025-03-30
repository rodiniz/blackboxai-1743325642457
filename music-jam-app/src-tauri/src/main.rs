#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::Manager;
use std::path::PathBuf;

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      #[cfg(debug_assertions)]
      app.get_window("main").unwrap().open_devtools();
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      save_audio_file,
      get_audio_devices,
      set_output_device
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
async fn save_audio_file(file_name: String, data: Vec<u8>) -> Result<String, String> {
  let audio_dir = PathBuf::from("audio");
  if !audio_dir.exists() {
    std::fs::create_dir(&audio_dir).map_err(|e| e.to_string())?;
  }
  
  let file_path = audio_dir.join(file_name);
  std::fs::write(&file_path, data)
    .map_err(|e| e.to_string())?;
    
  Ok(format!("Audio saved to {}", file_path.display()))
}

#[tauri::command]
async fn get_audio_devices() -> Result<Vec<(String, String)>, String> {
  // This would use platform-specific audio APIs
  // Mock implementation for now
  Ok(vec![
    ("input1".to_string(), "Built-in Microphone".to_string()),
    ("output1".to_string(), "Built-in Speakers".to_string())
  ])
}

#[tauri::command]
async fn set_output_device(device_id: String) -> Result<(), String> {
  // Platform-specific implementation would go here
  println!("Setting output device to {}", device_id);
  Ok(())
}