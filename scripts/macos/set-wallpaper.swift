#!/usr/bin/env swift
import AppKit
import Foundation

let args = CommandLine.arguments
guard args.count == 2 else {
  fputs("Usage: set-wallpaper.swift /absolute/path/to/image.png\n", stderr)
  exit(64)
}

let imagePath = args[1]
let imageURL = URL(fileURLWithPath: imagePath)

guard FileManager.default.fileExists(atPath: imagePath) else {
  fputs("Wallpaper image does not exist: \(imagePath)\n", stderr)
  exit(66)
}

let workspace = NSWorkspace.shared
let screens = NSScreen.screens
var failures: [String] = []

for screen in screens {
  do {
    try workspace.setDesktopImageURL(imageURL, for: screen, options: [:])
  } catch {
    let frame = NSStringFromRect(screen.frame)
    failures.append("Failed to set wallpaper for screen \(frame): \(error.localizedDescription)")
  }
}

if !failures.isEmpty {
  fputs(failures.joined(separator: "\n"), stderr)
  fputs("\n", stderr)
  exit(1)
}
