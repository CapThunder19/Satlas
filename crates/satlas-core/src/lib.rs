//! satlas-core: pure, network-free Bitcoin privacy analysis.
//!
//! The crate deliberately knows nothing about HTTP or WASM. Callers feed it
//! descriptors, transactions and labels; it returns analysis.

pub use miniscript;
pub use miniscript::bitcoin;

pub mod bip329;
pub mod chain;
pub mod descriptor;
pub mod error;
pub mod fmt;
pub mod heuristics;
pub mod labels;
pub mod simulate;
pub mod wallet;

pub use error::Error;

/// Crate version, exposed so consumers (e.g. the web UI) can display it.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
