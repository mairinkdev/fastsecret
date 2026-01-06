//! Secret detection rules
//!  
//! Built-in rules for common secrets (AWS, Stripe, OpenAI, etc.)
//! Support for custom rules loaded from YAML files

use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuleSeverity {
    High,
    Medium,
    Low,
}

impl std::str::FromStr for RuleSeverity {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "high" => Ok(RuleSeverity::High),
            "medium" => Ok(RuleSeverity::Medium),
            "low" => Ok(RuleSeverity::Low),
            _ => Err(format!("Unknown severity: {}", s)),
        }
    }
}

impl From<RuleSeverity> for String {
    fn from(sev: RuleSeverity) -> Self {
        match sev {
            RuleSeverity::High => "high".to_string(),
            RuleSeverity::Medium => "medium".to_string(),
            RuleSeverity::Low => "low".to_string(),
        }
    }
}


/// A secret detection rule with regex pattern and metadata
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Rule {
    pub name: String,
    pub pattern: String,
    #[serde(default = "default_severity")]
    pub severity: RuleSeverity,
    #[serde(default)]
    pub description: Option<String>,
}

fn default_severity() -> RuleSeverity {
    RuleSeverity::Medium
}

/// Load built-in secret detection rules
pub fn load_builtin_rules() -> Vec<Rule> {
    vec![
        // AWS Credentials
        Rule {
            name: "AWS Access Key ID".to_string(),
            pattern: r"AKIA[0-9A-Z]{16}".to_string(),
            severity: RuleSeverity::High,
            description: Some("Amazon AWS access key ID".to_string()),
        },
        Rule {
            name: "AWS Secret Access Key".to_string(),
            pattern: r#"(?i)aws_secret_access_key\s*=\s*['"]?([A-Za-z0-9/+=]{40})['"]?"#.to_string(),
            severity: RuleSeverity::High,
            description: Some("AWS secret access key".to_string()),
        },
        Rule {
            name: "AWS Session Token".to_string(),
            pattern: r#"(?i)aws_session_token\s*=\s*['"]?([A-Za-z0-9/+=]+)['"]?"#.to_string(),
            severity: RuleSeverity::High,
            description: Some("AWS temporary session token".to_string()),
        },
        
        // Google Cloud
        Rule {
            name: "Google API Key".to_string(),
            pattern: r"AIza[0-9A-Za-z\-_]{35}".to_string(),
            severity: RuleSeverity::High,
            description: Some("Google Cloud API key".to_string()),
        },
        Rule {
            name: "Google Cloud Service Account".to_string(),
            pattern: r#""type": "service_account""#.to_string(),
            severity: RuleSeverity::High,
            description: Some("Google Cloud service account JSON".to_string()),
        },
        
        // Stripe
        Rule {
            name: "Stripe Secret Key (Live)".to_string(),
            pattern: r"sk_live_[0-9a-zA-Z]{24,}".to_string(),
            severity: RuleSeverity::High,
            description: Some("Stripe live secret key".to_string()),
        },
        Rule {
            name: "Stripe Secret Key (Test)".to_string(),
            pattern: r"sk_test_[0-9a-zA-Z]{24,}".to_string(),
            severity: RuleSeverity::Medium,
            description: Some("Stripe test secret key".to_string()),
        },
        Rule {
            name: "Stripe Restricted API Key".to_string(),
            pattern: r"rk_live_[0-9a-zA-Z]{24,}".to_string(),
            severity: RuleSeverity::Medium,
            description: Some("Stripe restricted API key".to_string()),
        },
        
        // OpenAI
        Rule {
            name: "OpenAI API Key".to_string(),
            pattern: r"sk-[a-zA-Z0-9]{48}".to_string(),
            severity: RuleSeverity::High,
            description: Some("OpenAI API key".to_string()),
        },
        
        // Slack
        Rule {
            name: "Slack Bot Token".to_string(),
            pattern: r"xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9_]{24,26}".to_string(),
            severity: RuleSeverity::High,
            description: Some("Slack bot token".to_string()),
        },
        Rule {
            name: "Slack User Token".to_string(),
            pattern: r"xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9_]{26,32}".to_string(),
            severity: RuleSeverity::High,
            description: Some("Slack user token".to_string()),
        },
        Rule {
            name: "Slack Webhook".to_string(),
            pattern: r"https://hooks\.slack\.com/services/[A-Z0-9]{10}/[A-Z0-9]{10,12}/[a-zA-Z0-9_]{24,32}".to_string(),
            severity: RuleSeverity::High,
            description: Some("Slack webhook URL".to_string()),
        },
        
        // GitHub
        Rule {
            name:  "GitHub Personal Access Token".to_string(),
            pattern: r"ghp_[0-9a-zA-Z]{36}".to_string(),
            severity: RuleSeverity::High,
            description: Some("GitHub personal access token".to_string()),
        },
        Rule {
            name: "GitHub OAuth Token".to_string(),
            pattern: r"gho_[0-9a-zA-Z]{36}".to_string(),
            severity: RuleSeverity::High,
            description: Some("GitHub OAuth token".to_string()),
        },
        Rule {
            name: "GitHub App Token".to_string(),
            pattern: r"ghu_[0-9a-zA-Z]{36}".to_string(),
            severity: RuleSeverity::High,
            description: Some("GitHub app token".to_string()),
        },
        
        // Firebase
        Rule {
            name:  "Firebase API Key".to_string(),
            pattern: r"AIza[0-9A-Za-z\-_]{35}".to_string(),
            severity: RuleSeverity::Medium,
            description: Some("Firebase API key".to_string()),
        },
        
        // Twilio
        Rule {
            name: "Twilio API Key".to_string(),
            pattern:  r"SK[a-z0-9]{32}".to_string(),
            severity: RuleSeverity::High,
            description: Some("Twilio API key".to_string()),
        },
        
        // SendGrid
        Rule {
            name: "SendGrid API Key".to_string(),
            pattern: r"SG\.[a-zA-Z0-9_\-]{22,}".to_string(),
            severity: RuleSeverity::High,
            description: Some("SendGrid API key".to_string()),
        },
        
        // Database URIs
        Rule {
            name: "PostgreSQL Connection String".to_string(),
            pattern: r"postgres(?:ql)?://[^\s:]+:[^\s@]+@[^\s/:]+(?::\d+)?".to_string(),
            severity: RuleSeverity::High,
            description: Some("PostgreSQL URI with credentials".to_string()),
        },
        Rule {
            name: "MySQL Connection String".to_string(),
            pattern: r"mysql://[^\s:]+:[^\s@]+@[^\s/:]+(?::\d+)?".to_string(),
            severity: RuleSeverity::High,
            description: Some("MySQL URI with credentials".to_string()),
        },
        Rule {
            name: "MongoDB Connection String".to_string(),
            pattern: r"mongodb(?:\+srv)?://[^\s:]+:[^\s@]+@[^\s/:]+".to_string(),
            severity: RuleSeverity::High,
            description: Some("MongoDB URI with credentials".to_string()),
        },
        
        // Private Keys
        Rule {
            name:  "RSA Private Key".to_string(),
            pattern: r"-----BEGIN RSA PRIVATE KEY-----".to_string(),
            severity: RuleSeverity::High,
            description: Some("RSA private key".to_string()),
        },
        Rule {
            name:  "OpenSSH Private Key".to_string(),
            pattern: r"-----BEGIN OPENSSH PRIVATE KEY-----".to_string(),
            severity: RuleSeverity::High,
            description: Some("OpenSSH private key".to_string()),
        },
        Rule {
            name:  "ED25519 Private Key".to_string(),
            pattern: r"-----BEGIN PRIVATE KEY-----".to_string(),
            severity: RuleSeverity::High,
            description: Some("ED25519 or other private key".to_string()),
        },
        Rule {
            name: "PGP Private Key".to_string(),
            pattern: r"-----BEGIN PGP PRIVATE KEY BLOCK-----".to_string(),
            severity: RuleSeverity::High,
            description: Some("PGP private key block".to_string()),
        },
        
        // JWT & Tokens
        Rule {
            name: "JWT Token".to_string(),
            pattern: r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.".to_string(),
            severity: RuleSeverity::Medium,
            description: Some("JWT bearer token".to_string()),
        },
        
        // Slack App Config
        Rule {
            name: "Slack Signing Secret".to_string(),
            pattern: r#"(?i)slack_signing_secret\s*=\s*['"]([a-z0-9]+)['"]"#.to_string(),
            severity: RuleSeverity::High,
            description: Some("Slack app signing secret".to_string()),
        },
        
        // HashiCorp Vault
        Rule {
            name: "Vault Token".to_string(),
            pattern: r"hvs\.[a-zA-Z0-9_\.]{106}".to_string(),
            severity: RuleSeverity::High,
            description: Some("HashiCorp Vault token".to_string()),
        },
        
        // Cloudflare
        Rule {
            name: "Cloudflare API Token".to_string(),
            pattern: r"[a-z0-9]{40}".to_string(),
            severity: RuleSeverity::Low,
            description: Some("Potential Cloudflare API token".to_string()),
        },
        
        // Generic patterns
        Rule {
            name: "Generic High-Entropy Secret".to_string(),
            pattern: r#"(?i)(password|secret|token|key)\s*[=:]\s*['"]?([a-zA-Z0-9_\-+=\.]{32,})['"]?"#.to_string(),
            severity: RuleSeverity::Low,
            description: Some("Generic assignment of high-entropy string".to_string()),
        },
    ]
}

/// Load custom rules from a YAML file
pub fn load_custom_rules(path: &str) -> anyhow::Result<Vec<Rule>> {
    let content = fs::read_to_string(path)?;
    let rules: Vec<Rule> = serde_yaml::from_str(&content)?;
    Ok(rules)
}