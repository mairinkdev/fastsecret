//! Core scanning engine
//!
//!  Efficiently scans files and directories for secret patterns
//! using regex matching with performance optimizations.

use anyhow::Result;
use regex::Regex;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::rules::{Rule, RuleSeverity};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FindingSeverity {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone)]
pub struct Finding {
    pub file: String,
    pub line: usize,
    pub snippet: String,
    pub rule_name: String,
    pub severity: FindingSeverity,
}

/// Scan a file or directory for secrets
pub fn scan_path(
    root: &str,
    rules: &[Rule],
    ignore_rules: &[String],
    verbose: bool,
) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();
    let path = Path::new(root);

    if path.is_file() {
        scan_file(path, rules, ignore_rules, &mut findings, verbose)?;
    } else if path.is_dir() {
        for entry in WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| !should_skip_dir(e.path()))
        {
            if entry.path().is_file() {
                scan_file(entry.path(), rules, ignore_rules, &mut findings, verbose)?;
            }
        }
    }

    Ok(findings)
}

/// Scan a single file for secret matches
fn scan_file(
    path: &Path,
    rules: &[Rule],
    ignore_rules: &[String],
    findings: &mut Vec<Finding>,
    verbose: bool,
) -> Result<()> {
    // Skip binary files
    if is_binary_file(path) {
        return Ok(());
    }

    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Ok(()), // Skip files we can't read
    };

    let path_str = path.display().to_string();

    for (line_idx, line) in content.lines().enumerate() {
        for rule in rules {
            // Skip ignored rules
            if ignore_rules.contains(&rule.name) {
                continue;
            }

            // Compile regex and check for matches
            match Regex::new(&rule.pattern) {
                Ok(regex) => {
                    if let Some(_mat) = regex.find(line) {
                        let severity = convert_severity(rule.severity);

                        let snippet = if line.len() > 100 {
                            format!("{}...", &line[..97])
                        } else {
                            line.to_string()
                        };

                        findings.push(Finding {
                            file: path_str.clone(),
                            line: line_idx + 1,
                            snippet: snippet.trim().to_string(),
                            rule_name: rule.name.clone(),
                            severity,
                        });

                        if verbose {
                            eprintln!(
                                "  ✓ Matched '{}' at {}:{}",
                                rule.name,
                                path_str,
                                line_idx + 1
                            );
                        }
                    }
                }
                Err(e) => {
                    eprintln!("⚠️  Invalid regex in rule '{}': {}", rule.name, e);
                }
            }
        }
    }

    Ok(())
}

/// Convert RuleSeverity to FindingSeverity
fn convert_severity(sev: RuleSeverity) -> FindingSeverity {
    match sev {
        RuleSeverity::High => FindingSeverity::High,
        RuleSeverity::Medium => FindingSeverity::Medium,
        RuleSeverity::Low => FindingSeverity::Low,
    }
}

/// Directories to skip during traversal
fn should_skip_dir(path: &Path) -> bool {
    let skip_names = [
        ". git",
        ".github",
        "node_modules",
        ". venv",
        "venv",
        "__pycache__",
        "target",
        ". idea",
        ".vscode",
        "dist",
        "build",
        ". next",
        ".nuxt",
        ".cargo",
        "site-packages",
    ];

    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| skip_names.contains(&n))
        .unwrap_or(false)
}

/// Detect binary files by extension
fn is_binary_file(path: &Path) -> bool {
    let skip_exts = [
        "jpg", "jpeg", "png", "gif", "bmp", "svg", "ico", "webp", "zip", "tar", "gz", "rar", "7z",
        "exe", "dll", "so", "dylib", "bin", "o", "a", "lib", "pdf", "doc", "docx", "xls", "xlsx",
        "ppt", "pptx", "mp3", "mp4", "mov", "avi", "mkv", "flv", "wmv", "wav", "flac", "aac",
        "ogg",
    ];

    if let Some(ext) = path.extension() {
        if let Some(ext_str) = ext.to_str() {
            return skip_exts.contains(&ext_str.to_lowercase().as_str());
        }
    }
    false
}
