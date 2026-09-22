//! Formatting helpers for user-facing explanation text.

/// "0.23 BTC", "0.0299723 BTC", "1 BTC": trailing zeros trimmed.
pub fn btc(sats: u64) -> String {
    let whole = sats / 100_000_000;
    let frac = sats % 100_000_000;
    if frac == 0 {
        return format!("{whole} BTC");
    }
    let s = format!("{frac:08}");
    format!("{whole}.{} BTC", s.trim_end_matches('0'))
}

#[cfg(test)]
mod tests {
    #[test]
    fn formats() {
        assert_eq!(super::btc(23_000_000), "0.23 BTC");
        assert_eq!(super::btc(2_997_230), "0.0299723 BTC");
        assert_eq!(super::btc(100_000_000), "1 BTC");
        assert_eq!(super::btc(1), "0.00000001 BTC");
    }
}
