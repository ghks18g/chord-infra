'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AddressTag {
  address: string;
  nameTag: string;
  category: string;
  description?: string | null;
  source: string;
  isOfficial?: boolean;
}

interface AddressTagsContextType {
  tags: Map<string, AddressTag>;
  getTag: (address: string) => AddressTag | undefined;
  formatAddress: (address: string) => { label: string; isKnown: boolean; tag?: AddressTag };
  loading: boolean;
}

const AddressTagsContext = createContext<AddressTagsContextType>({
  tags: new Map(),
  getTag: () => undefined,
  formatAddress: (addr: string) => ({
    label: addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '-',
    isKnown: false,
  }),
  loading: false,
});

export function AddressTagsProvider({ children }: { children: React.ReactNode }) {
  const [tags, setTags] = useState<Map<string, AddressTag>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadTags() {
      try {
        const res = await fetch('/api/address-tags');
        if (res.ok) {
          const list: AddressTag[] = await res.json();
          if (mounted && Array.isArray(list)) {
            const map = new Map<string, AddressTag>();
            list.forEach((item) => {
              if (item?.address) {
                map.set(item.address.toLowerCase(), item);
              }
            });
            setTags(map);
          }
        }
      } catch (err) {
        console.error('Failed to load address tags:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadTags();
    return () => {
      mounted = false;
    };
  }, []);

  const getTag = (address: string): AddressTag | undefined => {
    if (!address) return undefined;
    return tags.get(address.toLowerCase());
  };

  const formatAddress = (address: string) => {
    if (!address) return { label: '-', isKnown: false };
    const tag = getTag(address);
    if (tag) {
      return { label: tag.nameTag, isKnown: true, tag };
    }
    return {
      label: `${address.slice(0, 8)}...${address.slice(-6)}`,
      isKnown: false,
    };
  };

  return (
    <AddressTagsContext.Provider value={{ tags, getTag, formatAddress, loading }}>
      {children}
    </AddressTagsContext.Provider>
  );
}

export function useAddressTags() {
  return useContext(AddressTagsContext);
}
