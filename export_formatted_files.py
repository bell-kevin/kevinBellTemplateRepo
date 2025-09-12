#!/usr/bin/env python3

import os
import tkinter as tk
from tkinter import filedialog
from pathlib import Path
import pathspec  # pip install pathspec

def get_directory():
    root = tk.Tk()
    root.withdraw()
    folder_selected = filedialog.askdirectory(title="Select Folder to Process")
    return folder_selected

def find_git_root(start_path):
    path = Path(start_path).resolve()
    for parent in [path] + list(path.parents):
        if (parent / ".git").is_dir():
            return parent
    return None

def load_gitignore_patterns(git_root):
    gitignore_file = git_root / '.gitignore'
    if not gitignore_file.exists():
        return None

    with open(gitignore_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    return pathspec.PathSpec.from_lines('gitwildmatch', lines)

def format_file_output(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            contents = f.read()
        header = f"\n--------------- {filepath} ---------------------\n"
        return header + contents.strip() + "\n"
    except Exception as e:
        return f"\n--------------- {filepath} ---------------------\n[Error reading file: {e}]\n"

def generate_tree(directory, git_root, ignore_spec, prefix=''):
    directory = Path(directory)
    git_root = Path(git_root)
    entries = sorted([e for e in directory.iterdir() if not (ignore_spec and ignore_spec.match_file(str(e.relative_to(git_root))))])

    tree_str = ''
    entries_count = len(entries)

    for idx, entry in enumerate(entries):
        connector = '└── ' if idx == entries_count - 1 else '├── '
        tree_str += f"{prefix}{connector}{entry.name}\n"

        if entry.is_dir():
            extension = '    ' if idx == entries_count - 1 else '│   '
            tree_str += generate_tree(entry, git_root, ignore_spec, prefix + extension)

    return tree_str

def process_directory(base_path, git_root, ignore_spec):
    output = ""
    base_path = Path(base_path)
    git_root = Path(git_root)

    for root, dirs, files in os.walk(base_path):
        root_path = Path(root)
        rel_root_to_git = os.path.relpath(root_path, git_root)

        if ignore_spec and ignore_spec.match_file(rel_root_to_git + "/"):
            dirs[:] = []
            continue

        for file in files:
            rel_file_to_git = os.path.relpath(root_path / file, git_root)
            if ignore_spec and ignore_spec.match_file(rel_file_to_git):
                continue

            full_path = root_path / file
            output += format_file_output(full_path)

    return output

def write_to_desktop(text_content, folder_name):
    desktop_path = Path.home() / "Desktop"
    file_name = f"{folder_name}.txt"
    file_path = desktop_path / file_name

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text_content)

    print(f"Formatted output saved to: {file_path}")
    return file_path

def main():
    folder_path = get_directory()
    if not folder_path:
        print("No folder selected. Exiting.")
        return

    folder_name = Path(folder_path).name
    git_root = find_git_root(folder_path)
    ignore_spec = load_gitignore_patterns(git_root) if git_root else None

    if git_root:
        print(f"Using .gitignore from: {git_root}")
    else:
        print("No .gitignore found above. Processing all files.")

    directory_listing = "Directory Listing:\n.\n"
    directory_listing += generate_tree(folder_path, git_root or folder_path, ignore_spec)
    directory_listing += "\n" + "="*60 + "\n"

    formatted_output = process_directory(folder_path, git_root or folder_path, ignore_spec)

    full_output = directory_listing + formatted_output
    write_to_desktop(full_output, folder_name)

if __name__ == "__main__":
    main()

