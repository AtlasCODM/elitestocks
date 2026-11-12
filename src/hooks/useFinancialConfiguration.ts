import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFinancialConfiguration } from "@/lib/financial-config.functions";

export function useFinancialConfiguration() {
  const fetchConfiguration = useServerFn(getFinancialConfiguration);
  return useQuery({
    queryKey: ["financial-config"],
    queryFn: () => fetchConfiguration(),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });
}
