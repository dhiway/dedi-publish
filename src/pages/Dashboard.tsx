import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  AlertCircle,
  MoreVertical,
  Copy,
  Info,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getNamespacesByProfile,
  createNamespace,
  updateNamespace,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
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

interface NamespaceFormData {
  name: string;
  description: string;
  metadata: string;
  meta: { [key: string]: unknown };
}

export function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ownedNamespaces, setOwnedNamespaces] = useState<Namespace[]>([]);
  const [delegatedNamespaces, setDelegatedNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDnsTxtModalOpen, setIsDnsTxtModalOpen] = useState(false);
  const [isGenerateDnsModalOpen, setIsGenerateDnsModalOpen] = useState(false);
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(
    null
  );
  const [domainInput, setDomainInput] = useState("");
  const [isGeneratingDns, setIsGeneratingDns] = useState(false);
  const [generatedTxt, setGeneratedTxt] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCreateMetadata, setShowCreateMetadata] = useState(false);
  const [showUpdateMetadata, setShowUpdateMetadata] = useState(false);
  const [createModalDomainInput, setCreateModalDomainInput] = useState("");
  const [isGeneratingCreateDns, setIsGeneratingCreateDns] = useState(false);
  const [createModalGeneratedTxt, setCreateModalGeneratedTxt] = useState<string | null>(null);
  const [isVerifyingCreate, setIsVerifyingCreate] = useState(false);
  const [createdNamespaceId, setCreatedNamespaceId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NamespaceFormData>({
    name: "",
    description: "",
    metadata: "",
    meta: {},
  });

  const fetchNamespaces = useCallback(async () => {
    try {
      setLoading(true);

      console.log("🔄 Fetching namespaces from API...");
      const result = await getNamespacesByProfile() as {
        message: string;
        data: {
          owned_namespaces?: Namespace[];
          delegated_namespaces?: Namespace[];
        };
      };
      console.log("📊 API response:", result);

      if (result.message === "User namespaces retrieved successfully") {
        // Process owned namespaces
        const ownedNamespacesWithProps = (result.data.owned_namespaces || []).map(
          (namespace: Namespace) => ({
            ...namespace,
            verified: false, // Default to false, can be updated based on business logic
            dnsTxt: null, // Default to null
          })
        );

        // Process delegated namespaces
        const delegatedNamespacesWithProps = (result.data.delegated_namespaces || []).map(
          (namespace: Namespace) => ({
            ...namespace,
            verified: false, // Default to false, can be updated based on business logic
            dnsTxt: null, // Default to null
          })
        );

        console.log("✅ Setting owned namespaces in state:", ownedNamespacesWithProps);
        console.log("✅ Setting delegated namespaces in state:", delegatedNamespacesWithProps);
        
        setOwnedNamespaces(ownedNamespacesWithProps);
        setDelegatedNamespaces(delegatedNamespacesWithProps);
      } else {
        // Don't show toast for "No namespaces found" as it's a normal case for new users
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
    // Only redirect if auth initialization is complete and user is not authenticated
    if (!isLoading && !isAuthenticated) {
      navigate("/");
    } else if (!isLoading && isAuthenticated) {
      fetchNamespaces();
    }
  }, [fetchNamespaces, isAuthenticated, isLoading, navigate]);

  // Show loading state while auth is initializing or while fetching namespaces
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

  const handleCreateNamespace = async () => {
    try {
      setIsCreating(true);

      // Validate required fields
      if (!formData.name.trim() || !formData.description.trim()) {
        toast({
          title: "Validation Error",
          description: "Name and description are required fields.",
          variant: "destructive",
        });
        return;
      }

      // Prepare meta field
      let meta;
      if (showCreateMetadata && Object.keys(formData.meta).length > 0) {
        meta = formData.meta;
      } else {
        meta = {};
      }

      const namespaceData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        meta: meta,
      };

      const result = await createNamespace(namespaceData) as {
        message: string;
        data: { namespace_id: string };
        error?: string; // Add the error property to the type
      };

      if (result.message === "Namespace created successfully") {
        toast({
          title: "🎉 Success!",
          description: `Namespace "${formData.name}" has been created successfully.`,
          className: "border-green-200 bg-green-50 text-green-900",
        });

        // Store the namespace_id for DNS and verify operations
        setCreatedNamespaceId(result.data.namespace_id);
        console.log("Created namespace ID:", result.data.namespace_id);

        // Close modal and reset form
        setIsCreateModalOpen(false);
        setFormData({ name: "", description: "", metadata: "", meta: {} });
        setShowCreateMetadata(false);
        setCreateModalDomainInput("");
        setCreateModalGeneratedTxt(null);

        // Refresh the namespaces list
        await fetchNamespaces();
      } else {
        // Handle API error response
        const errorMessage =
          result.message || result.error || "Failed to create namespace";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating namespace:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create namespace. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateModalGenerateDns = async () => {
    if (!createModalDomainInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid domain name.",
        variant: "destructive",
      });
      return;
    }

    // First create the namespace if it doesn't exist
    if (!createdNamespaceId) {
      await handleCreateNamespace();
      if (!createdNamespaceId) return; // If creation failed, don't proceed
    }

    try {
      setIsGeneratingCreateDns(true);

      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/generate-dns-txt/${createdNamespaceId}/${createModalDomainInput.trim()}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json() as {
        message?: string;
        txt?: string;
        error?: string;
      };

      if (response.ok) {
        setCreateModalGeneratedTxt(result.txt ?? null);
        toast({
          title: "DNS TXT Record Generated",
          description: result.message || "DNS TXT record has been generated successfully.",
          className: "border-green-200 bg-green-50 text-green-900",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to generate DNS TXT record.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating DNS TXT record:", error);
      toast({
        title: "Error",
        description: "Failed to generate DNS TXT record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCreateDns(false);
    }
  };

  const handleCreateModalVerify = async () => {
    // First create the namespace if it doesn't exist
    if (!createdNamespaceId) {
      await handleCreateNamespace();
      if (!createdNamespaceId) return; // If creation failed, don't proceed
    }

    try {
      setIsVerifyingCreate(true);

      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(`${API_BASE_URL}/dedi/verify-domain`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namespace_id: createdNamespaceId,
        }),
      });

      const result = await response.json() as {
        message: string;
      };

      if (response.ok) {
        toast({
          title: "✅ Verification Successful!",
          description: result.message || "Domain has been successfully verified.",
          className: "border-green-200 bg-green-50 text-green-900",
        });

        // Refresh the namespaces list to show updated verification status
        await fetchNamespaces();
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
    } finally {
      setIsVerifyingCreate(false);
    }
  };

  const handleUpdateNamespace = async () => {
    try {
      setIsUpdating(true);

      if (!selectedNamespace) {
        toast({
          title: "Error",
          description: "No namespace selected for update.",
          variant: "destructive",
        });
        return;
      }

      // Validate required fields
      if (!formData.name.trim() || !formData.description.trim()) {
        toast({
          title: "Validation Error",
          description: "Name and description are required fields.",
          variant: "destructive",
        });
        return;
      }

      // Prepare meta field
      let meta;
      if (showUpdateMetadata && Object.keys(formData.meta).length > 0) {
        meta = formData.meta;
      } else {
        meta = { additionalProp1: {} };
      }

      const namespaceData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        meta: meta,
      };

      const result = await updateNamespace(
        selectedNamespace.namespace_id,
        namespaceData
      ) as {
        message: string;
        error?: string;
      };

      console.log("🔍 Update namespace result:", result); // Debug log
      console.log("🔍 Result message:", result.message); // Debug log
      console.log(
        "🔍 Message comparison:",
        result.message === "namespace updated"
      ); // Debug log

      if (result.message === "namespace updated") {
        toast({
          title: "🎉 Success!",
          description: `Namespace "${formData.name}" has been updated successfully.`,
          className: "border-green-200 bg-green-50 text-green-900",
        });

        // Capture values before resetting
        const updatedNamespaceId = selectedNamespace.namespace_id;
        const updatedName = formData.name.trim();
        const updatedDescription = formData.description.trim();

        // Close modal and reset form
        setIsUpdateModalOpen(false);
        setSelectedNamespace(null);
        setFormData({ name: "", description: "", metadata: "", meta: {} });

        // Add retry logic to ensure we get the updated data
        const retryRefresh = async (attempt = 1, maxAttempts = 5) => {
          console.log(
            `🔄 Refreshing namespaces after update (attempt ${attempt})...`
          );

          try {
            const result = await getNamespacesByProfile() as {
              message: string;
              data: {
                owned_namespaces?: Namespace[];
                delegated_namespaces?: Namespace[];
              };
            };

            if (result.message === "User namespaces retrieved successfully") {
              const allNamespaces = [
                ...(result.data.owned_namespaces || []),
                ...(result.data.delegated_namespaces || []),
              ];

              // Check if the updated namespace is in the response
              const updatedNamespace = allNamespaces.find(
                (ns) => ns.namespace_id === updatedNamespaceId
              );

              if (
                updatedNamespace &&
                (updatedNamespace.name === updatedName ||
                  updatedNamespace.description === updatedDescription)
              ) {
                console.log("✅ Updated namespace found, refreshing UI...");
                await fetchNamespaces();
                return;
              }
            }

            // If we haven't found the updated data and haven't reached max attempts
            if (attempt < maxAttempts) {
              console.log(
                `⏳ Updated data not found, retrying in ${attempt * 500}ms...`
              );
              setTimeout(
                () => retryRefresh(attempt + 1, maxAttempts),
                attempt * 500
              );
            } else {
              console.log(
                "⚠️ Max retry attempts reached, doing final refresh..."
              );
              await fetchNamespaces();
            }
          } catch (error) {
            console.error("❌ Error during retry refresh:", error);
            if (attempt < maxAttempts) {
              setTimeout(
                () => retryRefresh(attempt + 1, maxAttempts),
                attempt * 500
              );
            }
          }
        };

        // Start the retry process after a short delay
        setTimeout(() => retryRefresh(), 500);
      } else {
        // Handle API error response
        const errorMessage =
          result.message || result.error || "Failed to update namespace";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating namespace:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update namespace. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerateDnsTxt = (namespace: Namespace) => {
    setSelectedNamespace(namespace);
    setDomainInput("");
    setGeneratedTxt(null);
    setIsGenerateDnsModalOpen(true);
  };

  const handleGenerateDnsTxtSubmit = async () => {
    if (!selectedNamespace || !domainInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid domain name.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGeneratingDns(true);

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/generate-dns-txt/${
          selectedNamespace.namespace_id
        }/${domainInput.trim()}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setGeneratedTxt(result.txt);

        // Update the namespace in the list with the DNS TXT record
        setOwnedNamespaces(prev =>
          prev.map((ns) =>
            ns.namespace_id === selectedNamespace.namespace_id
              ? { ...ns, dnsTxt: result.txt }
              : ns
          )
        );
        setDelegatedNamespaces(prev =>
          prev.map((ns) =>
            ns.namespace_id === selectedNamespace.namespace_id
              ? { ...ns, dnsTxt: result.txt }
              : ns
          )
        );

        toast({
          title: "DNS TXT Record Generated",
          description:
            result.message || "DNS TXT record has been generated successfully.",
          className: "border-green-200 bg-green-50 text-green-900",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to generate DNS TXT record.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating DNS TXT record:", error);
      toast({
        title: "Error",
        description: "Failed to generate DNS TXT record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDns(false);
    }
  };

  const handleViewDnsTxt = (namespace: Namespace) => {
    setSelectedNamespace(namespace);
    setIsDnsTxtModalOpen(true);
  };

  const handleVerifyNamespace = async (namespace: Namespace) => {
    try {
      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
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

      const result = await response.json();

      if (response.ok) {
        // Update the namespace as verified in the UI
        setOwnedNamespaces(prev =>
          prev.map((ns) =>
            ns.namespace_id === namespace.namespace_id
              ? { ...ns, verified: true }
              : ns
          )
        );
        setDelegatedNamespaces(prev =>
          prev.map((ns) =>
            ns.namespace_id === namespace.namespace_id
              ? { ...ns, verified: true }
              : ns
          )
        );

        toast({
          title: "✅ Verification Successful!",
          description:
            result.message || "Domain has been successfully verified.",
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

  const handleCopyDnsTxt = () => {
    if (selectedNamespace?.dnsTxt) {
      navigator.clipboard.writeText(selectedNamespace.dnsTxt);
      toast({
        title: "Success",
        description: "DNS TXT record copied to clipboard",
      });
      setIsDnsTxtModalOpen(false);
      setOwnedNamespaces(prev =>
        prev.map((ns) =>
          ns.namespace_id === selectedNamespace.namespace_id
            ? { ...ns, dnsTxt: selectedNamespace.dnsTxt }
            : ns
        )
      );
      setDelegatedNamespaces(prev =>
        prev.map((ns) =>
          ns.namespace_id === selectedNamespace.namespace_id
            ? { ...ns, dnsTxt: selectedNamespace.dnsTxt }
            : ns
        )
      );
    }
  };

  const openUpdateModal = (namespace: Namespace) => {
    setSelectedNamespace(namespace);

    // Check if namespace has meaningful metadata
    let hasMetadata = false;
    let metaObj = {};
    if (
      namespace.meta &&
      typeof namespace.meta === "object" &&
      Object.keys(namespace.meta).length > 0
    ) {
      // Check if meta has actual content (not just empty object or additionalProp1)
      const hasContent = Object.values(namespace.meta).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          (typeof value !== "object" || Object.keys(value).length > 0)
      );
      if (hasContent) {
        metaObj = namespace.meta;
        hasMetadata = true;
      }
    }

    setFormData({
      name: namespace.name,
      description: namespace.description,
      metadata: "",
      meta: metaObj,
    });
    setShowUpdateMetadata(hasMetadata);
    setIsUpdateModalOpen(true);
  };

  const handleNamespaceClick = (namespaceId: string, isOwned: boolean = true) => {
    navigate(`/namespaces/${namespaceId}?type=${isOwned ? 'owned' : 'delegated'}`);
  };

  const handleMetaChange = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      meta: {
        ...prev.meta,
        [key]: value,
      },
    }));
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Namespaces</h1>
            <p className="text-muted-foreground mt-2">
              Manage and organize your projects in dedicated namespaces
            </p>
          </div>
          <Button
            className="px-8 py-6 text-lg"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Namespace
          </Button>
        </div>
      </div>

      {ownedNamespaces.length === 0 && delegatedNamespaces.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No namespaces found</h3>
          <p className="text-muted-foreground">
            Get started by creating your first namespace
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* My Namespaces Section */}
          {ownedNamespaces.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  My Namespaces ({ownedNamespaces.length})
                </h2>
                {ownedNamespaces.length > 3 && (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/namespaces/owned')}
                  >
                    View More
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownedNamespaces.slice(0, 3).map((namespace) => (
                  <Card
                    key={namespace.namespace_id}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleNamespaceClick(namespace.namespace_id, true)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{namespace.name}</CardTitle>
                        <CardDescription>
                          <TruncatedText text={namespace.description} maxLength={100} />
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => openUpdateModal(namespace)}
                          >
                            Update
                          </DropdownMenuItem>
                          {!namespace.dnsTxt && (
                            <DropdownMenuItem
                              onClick={() => handleGenerateDnsTxt(namespace)}
                            >
                              Generate DNS TXT
                            </DropdownMenuItem>
                          )}
                          {namespace.dnsTxt && (
                            <DropdownMenuItem
                              onClick={() => handleViewDnsTxt(namespace)}
                            >
                              View DNS TXT
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Created:{" "}
                          {new Date(namespace.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Updated:{" "}
                          {new Date(namespace.updated_at).toLocaleDateString()}
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
                              handleVerifyNamespace(namespace);
                            }}
                          >
                            Verify
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Shared Namespaces Section */}
          {delegatedNamespaces.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Shared Namespaces ({delegatedNamespaces.length})
                </h2>
                {delegatedNamespaces.length > 3 && (
                  <Button
                    variant="outline"
                    onClick={() => navigate('/namespaces/shared')}
                  >
                    View More
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {delegatedNamespaces.slice(0, 3).map((namespace) => (
            <Card
              key={namespace.namespace_id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleNamespaceClick(namespace.namespace_id, false)}
            >
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{namespace.name}</CardTitle>
                  <CardDescription>
                    <TruncatedText text={namespace.description} maxLength={100} />
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={() => openUpdateModal(namespace)}
                    >
                      Update
                    </DropdownMenuItem>
                    {!namespace.dnsTxt && (
                      <DropdownMenuItem
                        onClick={() => handleGenerateDnsTxt(namespace)}
                      >
                        Generate DNS TXT
                      </DropdownMenuItem>
                    )}
                    {namespace.dnsTxt && (
                      <DropdownMenuItem
                        onClick={() => handleViewDnsTxt(namespace)}
                      >
                        View DNS TXT
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Created:{" "}
                    {new Date(namespace.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Updated:{" "}
                    {new Date(namespace.updated_at).toLocaleDateString()}
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
                        handleVerifyNamespace(namespace);
                      }}
                    >
                      Verify
                    </Button>
                  )}
                </div>
              </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Namespace Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Namespace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow alphanumeric characters, hyphens, and underscores
                  const filteredValue = value.replace(/[^a-zA-Z0-9_-]/g, "");
                  setFormData({ ...formData, name: filteredValue });
                }}
                placeholder="Enter namespace name (alphanumeric, _, - only)"
                required
              />
              <p className="text-xs text-muted-foreground">
                Only letters, numbers, underscores (_), and hyphens (-) are
                allowed
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                value={formData.description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 200) {
                    setFormData({ ...formData, description: value });
                  }
                }}
                placeholder="Enter namespace description"
                required
                maxLength={200}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">
                  Maximum 200 characters
                </span>
                <span
                  className={`${
                    formData.description.length > 180
                      ? "text-red-500"
                      : formData.description.length > 160
                      ? "text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {formData.description.length}/200
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">
                    Metadata (Optional)
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs p-2 text-sm">
                          <p className="font-bold">Customizable Metadata</p>
                          <p className="my-2">
                            These are the customizable fields where you can
                            define your own data types as per your application
                            needs.
                          </p>
                          <p className="font-semibold">Example:</p>
                          <div className="ml-2">
                            <p>
                              <code className="font-mono text-xs">
                                "bg-card-image"
                              </code>
                              :{" "}
                              <code className="font-mono text-xs">
                                "ImageUrl"
                              </code>
                            </p>
                          </div>
                          <p className="my-2 text-xs text-slate-50">
                            You can use this image URL as per your app
                            requirement.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  checked={showCreateMetadata}
                  onCheckedChange={setShowCreateMetadata}
                />
              </div>
              {showCreateMetadata && (
                <div className="grid gap-4">
                  {Object.keys(formData.meta).map((key, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-2 gap-2"
                    >
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const value = formData.meta[key];
                          setFormData((prev) => {
                            const newMeta = { ...prev.meta };
                            delete newMeta[key];
                            if (newKey) {
                              newMeta[newKey] = value;
                            }
                            return { ...prev, meta: newMeta };
                          });
                        }}
                        placeholder="key"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={
                            typeof formData.meta[key] === "string"
                              ? formData.meta[key]
                              : JSON.stringify(formData.meta[key])
                          }
                          onChange={(e) => {
                            let value: string = e.target.value;
                            // Try to parse as JSON if it looks like an object
                            if (
                              value.startsWith("{") ||
                              value.startsWith("[")
                            ) {
                              try {
                                value = JSON.parse(value);
                              } catch {
                                // Keep as string if parsing fails
                              }
                            }
                            handleMetaChange(key, value);
                          }}
                          placeholder="value"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setFormData((prev) => {
                              const newMeta = { ...prev.meta };
                              delete newMeta[key];
                              return { ...prev, meta: newMeta };
                            });
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        meta: { ...prev.meta, "": "" },
                      }));
                    }}
                  >
                    Add Metadata Field
                  </Button>
                </div>
              )}
            </div>
            
            {/* DNS TXT and Verify Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Domain for DNS TXT (Optional)</label>
                <Input
                  value={createModalDomainInput}
                  onChange={(e) => setCreateModalDomainInput(e.target.value)}
                  placeholder="Enter domain name (e.g., example.com)"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleCreateModalGenerateDns}
                  disabled={isGeneratingCreateDns || !createModalDomainInput.trim()}
                >
                  {isGeneratingCreateDns ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                      Generating...
                    </>
                  ) : (
                    "Generate DNS TXT"
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleCreateModalVerify}
                  disabled={isVerifyingCreate}
                >
                  {isVerifyingCreate ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                      Verifying...
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
              
              {createModalGeneratedTxt && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Generated DNS TXT Record:</label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    <code className="text-sm break-all">{createModalGeneratedTxt}</code>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(createModalGeneratedTxt);
                      toast({
                        title: "Copied!",
                        description: "DNS TXT record copied to clipboard",
                      });
                    }}
                    className="w-full"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </Button>
                </div>
              )}
            </div>
            
            <Button
              className="w-full"
              onClick={handleCreateNamespace}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Namespace Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Namespace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow alphanumeric characters, hyphens, and underscores
                  const filteredValue = value.replace(/[^a-zA-Z0-9_-]/g, "");
                  setFormData({ ...formData, name: filteredValue });
                }}
                placeholder="Enter namespace name (alphanumeric, _, - only)"
              />
              <p className="text-xs text-muted-foreground">
                Only letters, numbers, underscores (_), and hyphens (-) are
                allowed
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 200) {
                    setFormData({ ...formData, description: value });
                  }
                }}
                placeholder="Enter namespace description"
                maxLength={200}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">
                  Maximum 200 characters
                </span>
                <span
                  className={`${
                    formData.description.length > 180
                      ? "text-red-500"
                      : formData.description.length > 160
                      ? "text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {formData.description.length}/200
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">
                    Metadata (Optional)
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="max-w-xs p-2 text-sm">
                          <p className="font-bold">Customizable Metadata</p>
                          <p className="my-2">
                            These are the customizable fields where you can
                            define your own data types as per your application
                            needs.
                          </p>
                          <p className="font-semibold">Example:</p>
                          <div className="ml-2">
                            <p>
                              <code className="font-mono text-xs">
                                "bg-card-image"
                              </code>
                              :{" "}
                              <code className="font-mono text-xs">
                                "ImageUrl"
                              </code>
                            </p>
                          </div>
                          <p className="my-2 text-xs text-slate-50">
                            You can use this image URL as per your app
                            requirement.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  checked={showUpdateMetadata}
                  onCheckedChange={setShowUpdateMetadata}
                />
              </div>
              {showUpdateMetadata && (
                <div className="grid gap-4">
                  {Object.keys(formData.meta).map((key, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-2 gap-2"
                    >
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const value = formData.meta[key];
                          setFormData((prev) => {
                            const newMeta = { ...prev.meta };
                            delete newMeta[key];
                            if (newKey) {
                              newMeta[newKey] = value;
                            }
                            return { ...prev, meta: newMeta };
                          });
                        }}
                        placeholder="key"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={
                            typeof formData.meta[key] === "string"
                              ? formData.meta[key]
                              : JSON.stringify(formData.meta[key])
                          }
                          onChange={(e) => {
                            let value: string = e.target.value;
                            // Try to parse as JSON if it looks like an object
                            if (
                              value.startsWith("{") ||
                              value.startsWith("[")
                            ) {
                              try {
                                value = JSON.parse(value);
                              } catch {
                                // Keep as string if parsing fails
                              }
                            }
                            handleMetaChange(key, value);
                          }}
                          placeholder="value"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setFormData((prev) => {
                              const newMeta = { ...prev.meta };
                              delete newMeta[key];
                              return { ...prev, meta: newMeta };
                            });
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        meta: { ...prev.meta, "": "" },
                      }));
                    }}
                  >
                    Add Metadata Field
                  </Button>
                </div>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleUpdateNamespace}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate DNS TXT Modal */}
      <Dialog
        open={isGenerateDnsModalOpen}
        onOpenChange={setIsGenerateDnsModalOpen}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate DNS TXT Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!generatedTxt ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Domain Name *</label>
                  <Input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="Enter your domain name (e.g., example.com)"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the domain name you want to verify ownership for.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleGenerateDnsTxtSubmit}
                  disabled={isGeneratingDns || !domainInput.trim()}
                >
                  {isGeneratingDns ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">DNS TXT Record</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={generatedTxt}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedTxt);
                        toast({
                          title: "Success",
                          description: "DNS TXT record copied to clipboard",
                        });
                      }}
                      size="icon"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Add this TXT record to your domain's DNS settings to verify
                    ownership.
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View DNS TXT Modal */}
      <Dialog open={isDnsTxtModalOpen} onOpenChange={setIsDnsTxtModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DNS TXT Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input
                value={selectedNamespace?.dnsTxt || ""}
                readOnly
                className="font-mono"
              />
              <Button onClick={handleCopyDnsTxt} size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Add this TXT record to your domain's DNS settings to verify
              ownership.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
