import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.users.list.path);
      return api.users.list.responses[200].parse(await res.json());
    },
  });
}
