import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, error, isLoading } = useGetCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (error && (error as any).status === 401) {
      setLocation("/login");
    }
  }, [error, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
