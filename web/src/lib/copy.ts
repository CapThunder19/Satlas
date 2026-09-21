// Plain-language copy in one place so the UI stays consistent and easy to edit.

import type { Certainty, FindingKind, LinkageKind, OriginKind, Strategy, Verdict } from "../engine/types";

export const CERTAINTY: Record<Certainty, { label: string; short: string; long: string }> = {
  known: {
    label: "Fact",
    short: "Directly visible on the blockchain, or something you told Satlas.",
    long: "This is not a guess. It is either recorded on the blockchain for anyone to see, or it comes from a label you added yourself.",
  },
  inferred: {
    label: "Likely",
    short: "A well-known rule of thumb that is usually right, but not always.",
    long: "Blockchain analysts use this same rule. It is right most of the time, but there are exceptions, so treat it as a strong hint rather than proof.",
  },
  unknown: {
    label: "Unclear",
    short: "Satlas does not have enough information to say.",
    long: "Add labels to your coins to turn more of these into clear answers.",
  },
};

export const ORIGIN: Record<OriginKind, string> = {
  receive: "Someone sent you this",
  change: "Change from a payment you made",
  "self-transfer": "You moved this between your own addresses",
  unknown: "Origin unclear",
};

export const VERDICT: Record<Verdict, { title: string; cls: string; ring: string }> = {
  clean: {
    title: "Safe to send — reveals nothing new",
    cls: "border-emerald-800 bg-emerald-950/40 text-emerald-100",
    ring: "text-emerald-300",
  },
  caution: {
    title: "Mostly fine — some history gets exposed",
    cls: "border-amber-800 bg-amber-950/40 text-amber-100",
    ring: "text-amber-300",
  },
  linking: {
    title: "Careful — this connects coins that were separate",
    cls: "border-red-800 bg-red-950/40 text-red-100",
    ring: "text-red-300",
  },
};

export const STRATEGY: Record<Strategy, { label: string; hint: string }> = {
  "largest-first": { label: "Biggest coins first", hint: "What most wallets do automatically" },
  "oldest-first": { label: "Oldest coins first", hint: "Spend in the order you received them" },
  "smallest-first": { label: "Smallest coins first", hint: "Tidies up small coins, but uses more of them" },
  "exact-match": { label: "Avoid change", hint: "Find coins that add up to the amount exactly" },
  "privacy-aware": { label: "Best for privacy", hint: "Only use coins that are already linked together" },
  manual: { label: "I will pick the coins", hint: "Tick the coins you want to use" },
};

/** Practical advice per simulator linkage kind. */
export const LINKAGE_ADVICE: Record<LinkageKind, string | null> = {
  "label-mixing":
    "Pick coins from just one of these groups. Try “Best for privacy”, or tick the coins yourself. If the amount is too big for one group, consider two separate payments.",
  "cluster-merge":
    "If it matters that these groups stay separate, choose coins from a single group. If you do not mind them being connected, this is fine.",
  "reused-address-input":
    "You cannot undo the reuse, but you can avoid spending this coin together with coins you want to keep private. In future, always use a fresh address to receive.",
  "unlabelled-input": "Label these coins first (click “add label” on the coin) so Satlas can tell you whether mixing them matters.",
  "change-revealed":
    "Send a slightly odd amount instead of a round number, or use “Avoid change” so there is no change output at all.",
  "dust-change": "Round the amount up a little so the change is worth spending later, or add it to the fee.",
  "nothing-new": null,
};

/** Practical advice per wallet-history finding kind. */
export const FINDING_ADVICE: Record<FindingKind, string> = {
  "address-reuse":
    "Whoever paid this address can see everything else it received. Avoid spending these coins together with private ones, and never share the same receive address twice.",
  "cluster-merge":
    "This already happened, so there is nothing to undo. Just know that these coins are now publicly treated as one owner's.",
  "change-revealed":
    "The change coin from this payment is publicly tied to whatever you paid. Keep that in mind when you spend it.",
  "labels-linked":
    "These coins are already connected in public, so spending them together in future does not make things worse.",
};

export const FINDING_TITLE_FRIENDLY: Record<FindingKind, string> = {
  "address-reuse": "An address was used more than once",
  "cluster-merge": "A past payment connected two groups of coins",
  "change-revealed": "The change from a past payment is easy to spot",
  "labels-linked": "Coins with different labels are already connected",
};

export const GLOSSARY: { term: string; text: string }[] = [
  {
    term: "Coin",
    text: "Bitcoin is not one balance. Your wallet holds separate lumps called coins (technically “unspent transaction outputs”). Each one has its own history: who sent it and when.",
  },
  {
    term: "Group",
    text: "Coins that an outside observer can already tell belong to the same person, usually because they were spent together in one transaction. Spending coins from two different groups joins those groups forever.",
  },
  {
    term: "Change",
    text: "Coins rarely match the amount you want to pay. The leftover comes back to you as a new coin, like change from a shop. Observers try to guess which output is the change.",
  },
  {
    term: "Label",
    text: "A note you attach to a coin, such as “Salary” or “Donation”. Satlas uses your labels to tell you when a payment would connect two things you would rather keep apart. Labels stay in your browser.",
  },
  {
    term: "xpub / descriptor",
    text: "A public key for your whole wallet. It lets Satlas see your addresses and coins, but it can never spend them. It is safe to paste here; a seed phrase or private key is not, and Satlas will refuse it.",
  },
  {
    term: "Watch-only",
    text: "Satlas can look but not touch. It never signs or sends transactions. You still use your normal wallet to actually pay.",
  },
  {
    term: "Fact / Likely / Unclear",
    text: "Every conclusion is marked with how sure Satlas is. Fact = recorded on the blockchain or told by you. Likely = a common rule of thumb. Unclear = not enough information.",
  },
];

export const WALLET_XPUB_HINTS: { wallet: string; how: string }[] = [
  { wallet: "Sparrow", how: "Settings → Script Policy → copy the Descriptor (or Export → Output Descriptor)." },
  { wallet: "BlueWallet", how: "Open the wallet → ⋯ → Export/Backup → show XPUB (or ZPUB)." },
  { wallet: "Electrum", how: "Wallet → Information → Master Public Key." },
  { wallet: "Bitcoin Core", how: "listdescriptors in the console; copy a wpkh(…) or tr(…) descriptor without private keys." },
  { wallet: "Hardware wallets", how: "Use the companion app (Ledger Live, Trezor Suite, etc.) → account details → extended public key." },
];
