import Modal from "./Modal";
import { GLOSSARY } from "../lib/copy";

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How Satlas works" onClose={onClose}>
      <div className="space-y-4 text-sm text-zinc-300">
        <p>
          Every Bitcoin payment is public forever. When you pay someone, your wallet quietly picks
          which of your coins to use — and if it picks coins from different parts of your life, it
          tells the world they belong to the same person.
        </p>
        <p>
          Satlas shows you your coins one by one, lets you name them, and checks a payment{" "}
          <em>before</em> you send it. It never holds your keys and cannot move your money.
        </p>
        <dl className="space-y-3 border-t border-zinc-800 pt-4">
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <dt className="font-medium text-zinc-100">{g.term}</dt>
              <dd className="text-zinc-400">{g.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  );
}
