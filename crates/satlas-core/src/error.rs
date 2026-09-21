use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("invalid descriptor: {0}")]
    Descriptor(String),
    #[error("invalid transaction data: {0}")]
    Transaction(String),
    #[error("invalid label data: {0}")]
    Label(String),
    #[error("insufficient funds: need {needed} sat, have {available} sat")]
    InsufficientFunds { needed: u64, available: u64 },
}

pub type Result<T> = std::result::Result<T, Error>;
