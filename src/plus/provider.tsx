import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { readMembership, type Membership } from "../account/membership";
import { useAccount } from "../account/provider";
import { useAccountStorage } from "../account/storage-context";
import {
  cachedMembership,
  membershipCacheKey,
  membershipCacheWrite,
  plusAccess,
  type PlusAccess,
} from "./gate";

type PlusValue = PlusAccess & {
  /** This session's read of the account's membership, null until it arrives. */
  membership: Membership | null;
  /** The membership Plus access rests on: this session's read, else this device's last one. */
  known: Membership | null;
  /** The read failed. Access falls back to the cache, then Free. */
  failed: boolean;
  retry: () => void;
  /** A purchase or restore the store confirmed, before the server's own record is read. */
  purchased: (membership: Membership) => void;
};

const PlusContext = createContext<PlusValue | null>(null);

/** Reads the signed-in account's membership once and gives the whole app one Plus check. */
export function PlusProvider({ children }: PropsWithChildren) {
  const userId = useAccount().user?.id;
  const storage = useAccountStorage();
  const [membership, setMembership] = useState<Membership | null>(null);
  // The stored cache entry and the membership it still vouches for; undefined until read.
  const [cache, setCache] = useState<{ raw: string | null; valid: Membership | null }>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    storage
      .getItem(membershipCacheKey)
      .then((raw) => {
        if (live) setCache({ raw, valid: cachedMembership(raw, Date.now()) });
      })
      // An unreadable cache counts as none.
      .catch(() => {
        if (live) setCache({ raw: null, valid: null });
      });
    return () => {
      live = false;
    };
  }, [storage]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    setFailed(false);
    readMembership(userId)
      .then((value) => {
        if (live) setMembership(value);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [userId, attempt]);
  useEffect(() => {
    if (!membership || !cache) return;
    const entry = membershipCacheWrite(cache.raw, membership, Date.now());
    if (entry === null) return;
    setCache({ raw: entry, valid: membership });
    // shortcut: a failed cache write only costs the offline fallback until the next read.
    storage.setItem(membershipCacheKey, entry).catch(() => {});
  }, [membership, cache, storage]);
  const known = membership ?? cache?.valid ?? null;
  const value = useMemo<PlusValue>(
    () => ({
      ...plusAccess(known),
      membership,
      known,
      failed,
      retry: () => setAttempt((count) => count + 1),
      purchased(next) {
        setMembership(next);
        setFailed(false);
      },
    }),
    [known, membership, failed],
  );
  return <PlusContext.Provider value={value}>{children}</PlusContext.Provider>;
}

export function usePlus(): PlusValue {
  const plus = useContext(PlusContext);
  if (!plus) throw new Error("usePlus must be used inside PlusProvider");
  return plus;
}
