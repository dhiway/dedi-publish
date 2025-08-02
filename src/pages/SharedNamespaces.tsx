import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getNamespacesByProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SharedNamespaceCard } from "@/components/namespace/SharedNamespaceCard";
import { useToast } from "@/hooks/use-toast";

// Interface for namespace data from API
interface Namespace {
  digest: string;
  name: string;
  namespace_id: string;
  description: string;
  created_at: string;
  updated_at: string;
  version_count: number;
  version: string;
  registry_count: number;
  ttl: number;
  meta: {
    [key: string]: unknown;
  };
  is_verified: boolean;
  verified?: boolean;
  dnsTxt?: string | null;
}

export function SharedNamespacesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [delegatedNamespaces, setDelegatedNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNamespaces = useCallback(async () => {
    try {
      setLoading(true);

      console.log("🔄 Fetching shared namespaces from API...");
      const result = await getNamespacesByProfile() as {
        message: string;
        data: {
          delegated_namespaces: Namespace[];
        };
      };
      console.log("📊 API response:", result);

      if (result.message === "User namespaces retrieved successfully") {
        // Process delegated namespaces
        const delegatedNamespacesWithProps = (result.data.delegated_namespaces || []).map(
          (namespace: Namespace) => ({
            ...namespace,
            verified: false,
            dnsTxt: null,
          })
        );

        console.log("✅ Setting shared namespaces in state:", delegatedNamespacesWithProps);
        setDelegatedNamespaces(delegatedNamespacesWithProps);
      } else {
        if (result.message !== "No namespaces found") {
          toast({
            title: "Error",
            description: result.message || "Failed to fetch namespaces",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching namespaces:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to fetch namespaces. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/");
    } else if (!isLoading && isAuthenticated) {
      fetchNamespaces();
    }
  }, [fetchNamespaces, isAuthenticated, isLoading, navigate]);

  if (isLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleNamespaceClick = (namespaceId: string) => {
    navigate(`/namespaces/${namespaceId}?type=delegated`);
  };

  const handleVerifyNamespace = async (namespace: Namespace) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(`${API_BASE_URL}/dedi/verify-domain`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namespace_id: namespace.namespace_id,
        }),
      });

      const result = await response.json() as {
        message: string;
        data?: {
          dnsTxt: string;
        };
      };

      if (response.ok) {
        setDelegatedNamespaces(prev =>
          prev.map((ns) =>
            ns.namespace_id === namespace.namespace_id
              ? { ...ns, verified: true }
              : ns
          )
        );

        toast({
          title: "✅ Verification Successful!",
          description: result.message || "Domain has been successfully verified.",
          className: "border-green-200 bg-green-50 text-green-900",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: result.message || "Failed to verify domain.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error verifying namespace:", error);
      toast({
        title: "Error",
        description: "Failed to verify domain. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shared Namespaces</h1>
            <p className="text-muted-foreground mt-2">
              All namespaces shared with you ({delegatedNamespaces.length} total)
            </p>
          </div>
        </div>
      </div>

      {delegatedNamespaces.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No shared namespaces found</h3>
          <p className="text-muted-foreground">
            No namespaces have been shared with you yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {delegatedNamespaces.map((namespace) => (
            <SharedNamespaceCard
              key={namespace.namespace_id}
              namespace={namespace}
              onClick={handleNamespaceClick}
              onVerify={handleVerifyNamespace}
            />
          ))}
        </div>
      )}
    </div>
  );
}