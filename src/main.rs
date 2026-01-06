use anyhow::Result;
use clap::Parser;
use colored::*;
use std::process;

mod rules;
mod scanner;

use scanner::{scan_path, Finding};

/// ⚡ Lightning-fast secrets scanner for source code. 
/// Detects leaked API keys, credentials, tokens, and private keys. 
#[derive(Parser, Debug)]
#[command(
    name = "fastsecret",
    version = "0.1.0",
    about = "⚡ Lightning-fast secrets scanner — catch leaked credentials before they go public",
    long_about = None
)]
struct Args {
    /// Path to scan (file or directory)
    #[arg(value_name = "PATH")]
    path: String,

    /// Load custom rules from YAML file
    #[arg(long, value_name = "FILE")]
    rules: Option<String>,

    /// Ignore specific rules (comma-separated)
    #[arg(long, value_name = "RULES")]
    ignore_rules: Option<String>,

    /// Exit with code 2 if secrets found (for CI/CD)
    #[arg(long)]
    exit_on_secrets: bool,

    /// Verbose output (show all matches)
    #[arg(short, long)]
    verbose: bool,
}

fn main() -> Result<()> {
    let args = Args::parse();

    // Parse ignore rules
    let ignore_set = args
        .ignore_rules
        .as_ref()
        .map(|s| {
            s.split(',')
                .map(|r| r.trim().to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    // Load rules
    let mut rules = rules::load_builtin_rules();
    if let Some(rules_path) = args.rules {
        match rules::load_custom_rules(&rules_path) {
            Ok(custom) => {
                if args.verbose {
                    eprintln!("✓ Loaded {} custom rules", custom.len());
                }
                rules.extend(custom);
            }
            Err(e) => {
                eprintln!(
                    "{}",
                    format!("⚠️  Failed to load custom rules from '{}': {}", rules_path, e)
                        .yellow()
                );
            }
        }
    }

    // Perform scan
    let findings = scan_path(&args.path, &rules, &ignore_set, args.verbose)?;

    // Display results
    if findings.is_empty() {
        println!(
            "{}",
            "✅ No secrets detected.  You're safe! ".green().bold()
        );
        process::exit(0);
    } else {
        println!("{}", "🚨 Possible secrets found:".red().bold());
        display_findings(&findings);

        let count = findings.len();
        println!(
            "\n{}",
            format!("Found {} potential secret(s).", count)
                .red()
                .bold()
        );

        if args.exit_on_secrets {
            process::exit(2);
        } else {
            process::exit(0);
        }
    }
}

/// Display findings with color and formatting
fn display_findings(findings: &[Finding]) {
    for f in findings {
        let severity_display = match f.severity {
            scanner::FindingSeverity::High => "HIGH".red().bold(),
            scanner::FindingSeverity::Medium => "MEDIUM".yellow().bold(),
            scanner::FindingSeverity::Low => "LOW".cyan(),
        };

        let snippet = if f.snippet.len() > 80 {
            format!("{}...", &f.snippet[..77])
        } else {
            f.snippet.clone()
        };

        println!(
            "  {} {} {} {} ({})",
            format!("[{}: {}]", f.file, f.line).bright_blue(),
            severity_display,
            "—".dimmed(),
            f.rule_name.bold(),
            snippet.dimmed()
        );
    }
}