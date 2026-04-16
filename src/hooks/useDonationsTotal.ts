import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Возвращает суммарную сумму успешных пожертвований из view `donations_total`.
 */
export function useDonationsTotal() {
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("donations_total")
        .select("total_raised")
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("useDonationsTotal error:", error);
      } else {
        setTotal(Number(data?.total_raised ?? 0));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { total, loading };
}
