import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LoveContext = createContext(null);
const STORAGE_KEY = "love-names-v2";
const LEGACY_STORAGE_KEY = "love-names";

function readStoredNames() {
  const defaultNames = {
    yourName: "",
    loverName: "",
  };

  if (typeof window === "undefined") {
    return defaultNames;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return defaultNames;
    }

    const parsedValue = JSON.parse(rawValue);

    const storedYourName = typeof parsedValue.yourName === "string" ? parsedValue.yourName : "";
    const storedLoverName =
      typeof parsedValue.loverName === "string" ? parsedValue.loverName : "";

    // Remove the old demo names if they were previously saved.
    if (storedYourName === "Ayaan" && storedLoverName === "Mahi") {
      return defaultNames;
    }

    return {
      yourName: storedYourName,
      loverName: storedLoverName,
    };
  } catch (error) {
    console.error("Could not read love names", error);
    return defaultNames;
  }
}

export function LoveProvider({ children }) {
  const [names, setNames] = useState(readStoredNames);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  }, [names]);

  useEffect(() => {
    // Drop the legacy key so previously saved demo names cannot come back.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      ...names,
      namesLabel: `${names.yourName || "Your Name"} + ${names.loverName || "Lover Name"}`,
      setNames,
    }),
    [names]
  );

  return <LoveContext.Provider value={value}>{children}</LoveContext.Provider>;
}

export function useLove() {
  const context = useContext(LoveContext);

  if (!context) {
    throw new Error("useLove must be used inside LoveProvider");
  }

  return context;
}
