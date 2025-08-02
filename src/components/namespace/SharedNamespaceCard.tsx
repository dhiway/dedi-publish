import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TruncatedText } from "@/components/ui/truncated-text";

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

interface SharedNamespaceCardProps {
  namespace: Namespace;
  onClick: (namespaceId: string) => void;
  onVerify: (namespace: Namespace) => void;
}

export function SharedNamespaceCard({ namespace, onClick, onVerify }: SharedNamespaceCardProps) {
  return (
    <Card
      key={namespace.namespace_id}
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onClick(namespace.namespace_id)}
    >
      <CardHeader>
        <div>
          <CardTitle>{namespace.name}</CardTitle>
          <CardDescription>
            <TruncatedText text={namespace.description} maxLength={100} />
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Created: {new Date(namespace.created_at).toLocaleDateString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Updated: {new Date(namespace.updated_at).toLocaleDateString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Registries: {namespace.registry_count || 0}
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          {namespace.is_verified ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">Verified</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This namespace is verified</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium px-4 py-2 shadow-sm hover:shadow-md transition-all"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onVerify(namespace);
              }}
            >
              Verify
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}