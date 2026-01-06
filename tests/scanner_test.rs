use fastsecret::rules::load_builtin_rules;
use fastsecret::scanner::scan_path;

#[test]
fn test_aws_key_detection() {
    let rules = load_builtin_rules();
    let findings = scan_path("examples", &rules, &[], false)
        .expect("Scan should succeed");
    
    // docker-compose.env contains AWS keys
    assert!(
        findings.iter().any(|f| f.rule_name.contains("AWS")),
        "Should detect AWS keys in examples/"
    );
}

#[test]
fn test_stripe_key_detection() {
    let rules = load_builtin_rules();
    let findings = scan_path("examples", &rules, &[], false)
        .expect("Scan should succeed");
    
    // docker-compose.env contains Stripe key
    assert!(
        findings.iter().any(|f| f.rule_name.contains("Stripe")),
        "Should detect Stripe keys in examples/"
    );
}

#[test]
fn test_jwt_detection() {
    let rules = load_builtin_rules();
    let findings = scan_path("examples", &rules, &[], false)
        .expect("Scan should succeed");
    
    // appsettings.json contains JWT-like string
    assert!(
        findings.iter().any(|f| f.rule_name.contains("JWT")),
        "Should detect JWT tokens in examples/"
    );
}

#[test]
fn test_ignore_rules() {
    let rules = load_builtin_rules();
    let ignore = vec!["AWS Access Key ID".to_string()];
    let findings = scan_path("examples", &rules, &ignore, false)
        .expect("Scan should succeed");
    
    // Should not find AWS key when ignored
    assert!(
        !findings.iter().any(|f| f.rule_name == "AWS Access Key ID"),
        "Should ignore AWS keys when specified"
    );
}

#[test]
fn test_custom_rules() -> anyhow::Result<()> {
    let custom = fastsecret::rules::load_custom_rules("rules/custom-rules.yaml")?;
    
    assert!(!custom.is_empty(), "Should load custom rules");
    
    Ok(())
}

#[test]
fn test_empty_directory_scan() {
    let rules = load_builtin_rules();
    // Non-existent path should return empty findings
    let findings = scan_path("/nonexistent/path", &rules, &[], false)
        .expect("Scan should handle missing paths gracefully");
    
    assert_eq!(findings.len(), 0, "Non-existent path should return no findings");
}

#[test]
fn test_skip_binary_files() {
    let rules = load_builtin_rules();
    // Should skip binary files in scan
    let findings = scan_path("examples", &rules, &[], false)
        .expect("Scan should succeed");
    
    // All findings should be from text files
    for finding in &findings {
        assert!(
            !finding.file.ends_with(".bin")
                && !finding.file.ends_with(".exe")
                && !finding.file.ends_with(".zip"),
            "Should skip binary files"
        );
    }
}