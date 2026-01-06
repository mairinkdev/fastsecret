//! fastsecret:  Lightning-fast secrets scanner for source code
//!  
//! This crate provides:
//! - Fast regex-based secret pattern detection
//! - Built-in rules for 50+ secret types
//! - Pluggable custom rule support
//! - Efficient file scanning and filtering

pub mod rules;
pub mod scanner;

pub use rules::{Rule, RuleSeverity};
pub use scanner::{Finding, FindingSeverity, scan_path};