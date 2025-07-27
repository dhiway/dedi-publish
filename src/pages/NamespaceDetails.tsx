import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Upload,
  MoreVertical,
  Archive,
  RotateCcw,
  Ban,
  CheckCircle,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import schema JSON files
import membershipSchema from "@/schema/membership.json";
import publicKeySchema from "@/schema/public_key.json";
import revokeSchema from "@/schema/revoke.json";

// Utility function to extract properties from JSON schema
const extractSchemaProperties = (schema: any): { [key: string]: any } => {
  const properties = schema.properties || {};
  const extractedProps: { [key: string]: any } = {};

  const processProperty = (key: string, property: any): void => {
    if (property.type) {
      // Handle different types
      switch (property.type) {
        case "string":
          extractedProps[key] = "string";
          break;
        case "integer":
        case "number":
          extractedProps[key] = "integer";
          break;
        case "boolean":
          extractedProps[key] = "boolean";
          break;
        case "array":
          // Handle array with nested object properties
          if (
            property.items &&
            property.items.type === "object" &&
            property.items.properties
          ) {
            const itemProperties: { [key: string]: string } = {};
            Object.keys(property.items.properties).forEach((itemKey) => {
              const itemProperty = property.items.properties[itemKey];
              switch (itemProperty.type) {
                case "string":
                  itemProperties[itemKey] = "string";
                  break;
                case "integer":
                case "number":
                  itemProperties[itemKey] = "integer";
                  break;
                case "boolean":
                  itemProperties[itemKey] = "boolean";
                  break;
                default:
                  itemProperties[itemKey] = "string";
              }
            });
            extractedProps[key] = { type: "array", itemProperties };
          } else {
            extractedProps[key] = "array";
          }
          break;
        case "object":
          // For objects, we'll flatten the nested properties
          if (property.properties) {
            Object.keys(property.properties).forEach((nestedKey) => {
              const nestedProperty = property.properties[nestedKey];
              processProperty(`${key}_${nestedKey}`, nestedProperty);
            });
          } else {
            extractedProps[key] = "object";
          }
          break;
        default:
          extractedProps[key] = "string";
      }
    } else {
      extractedProps[key] = "string";
    }
  };

  Object.keys(properties).forEach((key) => {
    processProperty(key, properties[key]);
  });

  return extractedProps;
};

// Helper function to convert complex schema to simple key-value for API
const convertSchemaForAPI = (extractedSchema: {
  [key: string]: any;
}): { [key: string]: string } => {
  const apiSchema: { [key: string]: string } = {};

  Object.keys(extractedSchema).forEach((key) => {
    const value = extractedSchema[key];
    if (typeof value === "object" && value.type === "array") {
      // For array types, we'll store as 'array' in the API
      apiSchema[key] = "array";
    } else {
      apiSchema[key] = String(value);
    }
  });
  return apiSchema;
};

// Schema configurations
const schemaConfigs = {
  blank: {
    name: "Blank Schema",
    description: "Create your own custom schema",
    icon: Plus,
    color: "bg-gray-100",
    iconColor: "text-gray-600",
    schema: null,
    tooltip: "Start with an empty schema and add your own fields",
  },
  membership: {
    name: "Membership",
    description: "Membership affiliation schema",
    icon: CheckCircle,
    color: "bg-blue-100",
    iconColor: "text-blue-600",
    schema: membershipSchema,
    tooltip: membershipSchema.description,
  },
  publicKey: {
    name: "Public Key",
    description: "Public key directory schema",
    icon: Archive,
    color: "bg-green-100",
    iconColor: "text-green-600",
    schema: publicKeySchema,
    tooltip: publicKeySchema.description,
  },
  revoke: {
    name: "Revoke",
    description: "Revocation/blacklist schema",
    icon: Ban,
    color: "bg-red-100",
    iconColor: "text-red-600",
    schema: revokeSchema,
    tooltip: revokeSchema.description,
  },
};

// Updated interface to match API response
interface Registry {
  digest: string;
  registry_id: string;
  registry_name: string;
  description: string;
  created_by: string;
  schema: unknown;
  created_at: string;
  updated_at: string;
  record_count: number;
  version_count: number;
  version: string;
  query_allowed: boolean;
  is_revoked: boolean;
  is_archived: boolean;
  delegates: unknown[];
  meta: unknown;
}

interface RegistryFormData {
  name: string;
  description: string;
  schema: string;
  metadata: string;
  meta: { [key: string]: unknown };
}

interface SchemaField {
  key: string;
  type: string;
}

interface DelegateFormData {
  email: string;
}

// Interface for API response
interface NamespaceQueryResponse {
  message: string;
  data: {
    namespace_id: string;
    namespace_name: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    total_registries: number;
    registries: Registry[];
    ttl: number;
  };
}

// Interface for bulk upload initial response
interface BulkUploadInitialResponse {
  status: string;
  message: string;
  data: {
    jobId: string;
    totalFiles: number;
    statusCheckUrl: string;
  };
}

// Interface for file result in status response
interface FileResult {
  status: string;
  fileName: string;
  registryId?: string;
  namespaceId?: string;
  entriesCount?: number;
  error?: string;
}

// Interface for bulk upload status response
interface BulkUploadStatusResponse {
  status: string;
  message: string;
  data: {
    jobId: string;
    status: string;
    progress: number;
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    createdAt: string;
    updatedAt: string;
    error: string | null;
    results: FileResult[];
    namespace: string;
  };
}

export function NamespaceDetailsPage() {
  const { namespaceId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [namespaceName, setNamespaceName] = useState<string>("Loading...");
  const [totalRegistries, setTotalRegistries] = useState<number>(0);
  const [revokedRegistriesCount, setRevokedRegistriesCount] =
    useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [processedFiles, setProcessedFiles] = useState<number>(0);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [completedFileNames, setCompletedFileNames] = useState<Set<string>>(
    new Set()
  );
  const [globalUploadStatus, setGlobalUploadStatus] = useState<{
    isUploading: boolean;
    message: string;
    namespaceId: string;
    progress?: number;
  } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [isArchiveAlertOpen, setIsArchiveAlertOpen] = useState(false);
  const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
  const [isRevokeAlertOpen, setIsRevokeAlertOpen] = useState(false);
  const [isReinstateAlertOpen, setIsReinstateAlertOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedRegistry, setSelectedRegistry] = useState<Registry | null>(
    null
  );
  const [createFormData, setCreateFormData] = useState<RegistryFormData>({
    name: "",
    description: "",
    schema: "",
    metadata: "",
    meta: {},
  });
  const [updateFormData, setUpdateFormData] = useState<RegistryFormData>({
    name: "",
    description: "",
    schema: "",
    metadata: "",
    meta: {},
  });
  const [delegateFormData, setDelegateFormData] = useState<DelegateFormData>({
    email: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([
    { key: "", type: "string" },
  ]);
  const [showCreateMetadata, setShowCreateMetadata] = useState(false);
  const [showUpdateMetadata, setShowUpdateMetadata] = useState(false);
  const [selectedSchemaType, setSelectedSchemaType] = useState<string>("blank");
  const [showSchemaBuilder, setShowSchemaBuilder] = useState(false);

  // Check for ongoing upload on component mount
  useEffect(() => {
    const savedUploadStatus = localStorage.getItem("bulkUploadStatus");
    if (savedUploadStatus) {
      try {
        const uploadStatus = JSON.parse(savedUploadStatus);
        if (uploadStatus.isUploading && uploadStatus.jobId) {
          setGlobalUploadStatus(uploadStatus);
          setUploadJobId(uploadStatus.jobId);
          setUploadLoading(true);
          setUploadProgressPercent(uploadStatus.progress || 0);
          setTotalFiles(uploadStatus.totalFiles || 0);
          setProcessedFiles(uploadStatus.processedFiles || 0);
        }
      } catch (error) {
        localStorage.removeItem("bulkUploadStatus");
      }
    }
  }, []);

  // Save upload status to localStorage whenever it changes
  useEffect(() => {
    if (globalUploadStatus && uploadJobId) {
      const statusToSave = {
        ...globalUploadStatus,
        jobId: uploadJobId,
        totalFiles: totalFiles,
        processedFiles: processedFiles,
      };
      localStorage.setItem("bulkUploadStatus", JSON.stringify(statusToSave));
    } else {
      localStorage.removeItem("bulkUploadStatus");
    }
  }, [globalUploadStatus, uploadJobId, totalFiles, processedFiles]);

  useEffect(() => {
    if (namespaceId) {
      fetchRegistries();
      fetchRevokedRegistriesCount();
    }
  }, [namespaceId]);

  // Polling effect for bulk upload job status
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const pollJobStatus = async () => {
      if (!uploadJobId) return;

      try {
        // Cookie authentication is handled automatically by credentials: 'include'

        const API_BASE_URL =
          import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
        const response = await fetch(
          `${API_BASE_URL}/dedi/bulk-upload/status/${uploadJobId}`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          console.error("Failed to fetch job status:", response.status);
          return;
        }

        const result: BulkUploadStatusResponse = await response.json();
        console.log("📊 Job status response:", result);

        if (result.status === "success" && result.data) {
          const {
            status,
            progress,
            processedFiles: newProcessedFiles,
            totalFiles: newTotalFiles,
            results,
          } = result.data;

          // Update progress
          setUploadProgressPercent(progress);
          setProcessedFiles(newProcessedFiles);
          setTotalFiles(newTotalFiles);

          // Update global status with progress
          setGlobalUploadStatus((prev) =>
            prev
              ? {
                  ...prev,
                  message: `Processing files... ${newProcessedFiles}/${newTotalFiles} completed`,
                  progress: progress,
                }
              : null
          );

          // Check for newly completed files and show toasts
          const currentCompletedFiles = new Set(
            results.filter((r) => r.status === "success").map((r) => r.fileName)
          );
          const newlyCompleted = [...currentCompletedFiles].filter(
            (fileName) => !completedFileNames.has(fileName)
          );

          newlyCompleted.forEach((fileName) => {
            const fileResult = results.find((r) => r.fileName === fileName);
            if (fileResult) {
              toast({
                title: "✅ File Processed",
                description: `${fileName} has been successfully processed${
                  fileResult.entriesCount
                    ? ` (${fileResult.entriesCount} entries)`
                    : ""
                }`,
                className: "border-green-200 bg-green-50 text-green-900",
                duration: 3000,
              });
            }
          });

          setCompletedFileNames(currentCompletedFiles);

          // Update progress log
          setUploadProgress((prev) => {
            const newMessages = [...prev];
            newlyCompleted.forEach((fileName) => {
              const fileResult = results.find((r) => r.fileName === fileName);
              if (fileResult) {
                newMessages.push(
                  `✅ ${fileName} processed successfully${
                    fileResult.entriesCount
                      ? ` (${fileResult.entriesCount} entries)`
                      : ""
                  }`
                );
              }
            });
            return newMessages;
          });

          // Check if job is completed (check for both "completed" status OR 100% progress)
          if (status === "completed" || progress === 100) {
            console.log("🎉 Bulk upload completed!");

            // Clear polling
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }

            // Clear job ID to stop polling
            setUploadJobId(null);
            setUploadLoading(false);

            // Update global status to show completion and then clear it after a delay
            setGlobalUploadStatus((prev) =>
              prev
                ? {
                    ...prev,
                    message: `Completed! All ${newTotalFiles} files processed successfully`,
                    progress: 100,
                    isUploading: false, // Mark as not uploading anymore
                  }
                : null
            );

            // Clear the global status after showing completion for a few seconds
            setTimeout(() => {
              setGlobalUploadStatus(null);
            }, 3000);

            // Show completion toast
            toast({
              title: "🎉 Bulk Upload Complete!",
              description: `All ${newTotalFiles} files have been successfully processed!`,
              className: "border-green-200 bg-green-50 text-green-900",
              duration: 5000,
            });

            // Add completion message to progress log
            setUploadProgress((prev) => [
              ...prev,
              `🎉 Upload completed! All ${newTotalFiles} files processed successfully.`,
            ]);

            // Refresh registries
            setTimeout(async () => {
              try {
                // Call fetchRegistries directly since refreshRegistries is not available in scope
                await fetchRegistries();
                console.log(
                  "✅ Registries refreshed after bulk upload completion"
                );
              } catch (error) {
                console.error("❌ Failed to refresh registries:", error);
                toast({
                  title: "Warning",
                  description:
                    "Upload completed but failed to refresh list. Please refresh manually.",
                  variant: "destructive",
                });
              }
            }, 1000);

            // Don't auto-close modal - let user close it manually or via the "Continue Working" button
            // The modal will show completion state with option to close
          } else if (status === "failed" || result.data.error) {
            console.error("❌ Bulk upload failed:", result.data.error);

            // Clear polling
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }

            setUploadJobId(null);
            setUploadLoading(false);
            setGlobalUploadStatus(null);

            toast({
              title: "Upload Failed",
              description:
                result.data.error || "Bulk upload failed. Please try again.",
              variant: "destructive",
              duration: 7000,
            });
          }
        }
      } catch (error) {
        console.error("Error polling job status:", error);
      }
    };

    if (uploadJobId && uploadLoading) {
      // Initial poll immediately
      pollJobStatus();

      // Start polling every 5 seconds
      intervalId = setInterval(pollJobStatus, 5000);
    }

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [uploadJobId, uploadLoading, completedFileNames, toast]);

  const fetchRegistries = async () => {
    try {
      console.log("🔄 Fetching registries...");
      setLoading(true);
      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/query/${namespaceId}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result: NamespaceQueryResponse = await response.json();
      console.log("📊 Registries API response:", result);

      if (result.message === "Resource retrieved successfully") {
        // Group registries by registry_id and keep only the latest version of each
        const registryMap = new Map<string, Registry>();

        result.data.registries.forEach((registry) => {
          const existingRegistry = registryMap.get(registry.registry_id);

          if (!existingRegistry) {
            // First time seeing this registry_id, add it
            registryMap.set(registry.registry_id, registry);
          } else {
            // Registry already exists, keep the one with latest updated_at
            const existingDate = new Date(
              existingRegistry.updated_at
            ).getTime();
            const currentDate = new Date(registry.updated_at).getTime();

            if (currentDate > existingDate) {
              registryMap.set(registry.registry_id, registry);
            }
          }
        });

        // Convert map back to array and sort by updated_at in descending order
        const uniqueRegistries = Array.from(registryMap.values()).sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        setRegistries(uniqueRegistries);
        setNamespaceName(result.data.namespace_name);
        setTotalRegistries(result.data.total_registries);
        console.log(
          "✅ Registries updated:",
          uniqueRegistries.length,
          "registries"
        );
      } else {
        console.error("❌ Failed to fetch registries:", result.message);
        toast({
          title: "Error",
          description: result.message || "Failed to fetch registries",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Error fetching registries:", error);
      toast({
        title: "Error",
        description: "Failed to fetch registries. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Separate function for refreshing registries without affecting main loading state
  const refreshRegistries = async () => {
    try {
      console.log("🔄 Refreshing registries (silent)...");
      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/query/${namespaceId}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result: NamespaceQueryResponse = await response.json();
      console.log("📊 Silent refresh API response:", result);

      if (result.message === "Resource retrieved successfully") {
        // Group registries by registry_id and keep only the latest version of each
        const registryMap = new Map<string, Registry>();

        result.data.registries.forEach((registry) => {
          const existingRegistry = registryMap.get(registry.registry_id);

          if (!existingRegistry) {
            registryMap.set(registry.registry_id, registry);
          } else {
            const existingDate = new Date(
              existingRegistry.updated_at
            ).getTime();
            const currentDate = new Date(registry.updated_at).getTime();

            if (currentDate > existingDate) {
              registryMap.set(registry.registry_id, registry);
            }
          }
        });

        // Convert map back to array and sort by updated_at in descending order
        const uniqueRegistries = Array.from(registryMap.values()).sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        setRegistries(uniqueRegistries);
        setNamespaceName(result.data.namespace_name);
        setTotalRegistries(result.data.total_registries);
        console.log(
          "✅ Registries silently refreshed:",
          uniqueRegistries.length,
          "registries"
        );

        // Also refresh revoked registries count
        await fetchRevokedRegistriesCount();

        return true;
      } else {
        console.error("❌ Failed to refresh registries:", result.message);
        return false;
      }
    } catch (error) {
      console.error("❌ Error refreshing registries:", error);
      return false;
    }
  };

  const fetchRevokedRegistriesCount = async () => {
    try {
      console.log("🔄 Fetching revoked registries count...");
      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/query/${namespaceId}?status=revoked`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result: NamespaceQueryResponse = await response.json();
      console.log("📊 Revoked registries API response:", result);

      if (result.message === "Resource retrieved successfully") {
        setRevokedRegistriesCount(result.data.total_registries);
        console.log(
          "✅ Revoked registries count updated:",
          result.data.total_registries
        );
      } else {
        console.log(
          "ℹ️ No revoked registries found or API error:",
          result.message
        );
        setRevokedRegistriesCount(0);
      }
    } catch (error) {
      console.error("❌ Error fetching revoked registries count:", error);
      setRevokedRegistriesCount(0);
    }
  };

  const handleCreateRegistry = async () => {
    if (createLoading) return; // Prevent multiple submissions

    try {
      setCreateLoading(true);

      // Validate required fields
      if (!createFormData.name.trim()) {
        toast({
          title: "Validation Error",
          description: "Registry name is required",
          variant: "destructive",
        });
        return;
      }

      if (!createFormData.description.trim()) {
        toast({
          title: "Validation Error",
          description: "Description is required",
          variant: "destructive",
        });
        return;
      }

      // Handle schema based on selected type
      let parsedSchema: { [key: string]: string } = {};

      if (selectedSchemaType === "blank") {
        // Validate schema fields for blank schema
        const validSchemaFields = schemaFields.filter(
          (field) => field.key.trim() !== ""
        );
        if (validSchemaFields.length === 0) {
          toast({
            title: "Validation Error",
            description: "At least one schema field is required",
            variant: "destructive",
          });
          return;
        }

        // Check for duplicate keys
        const keys = validSchemaFields.map((field) => field.key.trim());
        const uniqueKeys = new Set(keys);
        if (keys.length !== uniqueKeys.size) {
          toast({
            title: "Validation Error",
            description: "Schema field keys must be unique",
            variant: "destructive",
          });
          return;
        }

        // Convert schema fields to an object with string keys and string values.
        parsedSchema = validSchemaFields.reduce((acc, field) => {
          acc[field.key.trim()] = String(field.type);
          return acc;
        }, {} as { [key: string]: string });
      } else {
        // Use dynamic schema extraction from JSON files
        const schemaConfig =
          schemaConfigs[selectedSchemaType as keyof typeof schemaConfigs];
        if (schemaConfig && schemaConfig.schema) {
          const extractedSchema = extractSchemaProperties(schemaConfig.schema);
          parsedSchema = convertSchemaForAPI(extractedSchema);
        } else {
          toast({
            title: "Schema Error",
            description: "Selected schema type is not available",
            variant: "destructive",
          });
          return;
        }

        // Check for duplicate keys
        const keys = validSchemaFields.map(field => field.key.trim());
        const uniqueKeys = new Set(keys);
        if (keys.length !== uniqueKeys.size) {
          toast({
            title: 'Validation Error',
            description: 'Schema field keys must be unique',
            variant: 'destructive',
          });
          return;
        }

        // Convert schema fields to an object with string keys and string values.
        parsedSchema = validSchemaFields.reduce((acc, field) => {
          acc[field.key.trim()] = String(field.type);
          return acc;
        }, {} as { [key: string]: string });
      } else {
        // Use dynamic schema extraction from JSON files
        const schemaConfig = schemaConfigs[selectedSchemaType as keyof typeof schemaConfigs];
        if (schemaConfig && schemaConfig.schema) {
          const extractedSchema = extractSchemaProperties(schemaConfig.schema);
          parsedSchema = convertSchemaForAPI(extractedSchema);
        } else {
          toast({
            title: 'Schema Error',
            description: 'Selected schema type is not available',
            variant: 'destructive',
          });
          return;
        }
      }

      // Parse metadata (optional)
      let parsedMeta = {};
      if (showCreateMetadata && Object.keys(createFormData.meta).length > 0) {
        parsedMeta = createFormData.meta;
      }

      // Parse metadata (optional)
      let parsedMeta = {};
      if (showCreateMetadata && Object.keys(createFormData.meta).length > 0) {
        parsedMeta = createFormData.meta;
      }

      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      
      console.log('🔄 Creating registry with API call to:', `${API_BASE_URL}/dedi/${namespaceId}/create-registry`);
      console.log('📝 Request payload:', {
        registry_name: createFormData.name.trim(),
        description: createFormData.description.trim(),
        schema: convertSchemaForAPI(parsedSchema),
        query_allowed: true,
        ...(Object.keys(parsedMeta).length > 0 && { meta: parsedMeta }),
      });
      
      // Debug: Check if cookies are available
      console.log('🍪 Document cookies:', document.cookie);
      console.log('🔐 Checking authentication state...');
      
      // Check if token cookie exists
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
      console.log('🔍 Token cookie found:', !!tokenCookie);
      
      if (tokenCookie) {
        try {
          const tokenValue = tokenCookie.split('=')[1];
          const parsedToken = JSON.parse(decodeURIComponent(tokenValue));
          console.log('✅ Token parsed successfully:', !!parsedToken.access_token);
        } catch (e) {
          console.log('❌ Error parsing token:', e);
        }
      } else {
        console.log('❌ No token cookie found - this is the authentication issue!');
      }
      
      const response = await fetch(
        `${API_BASE_URL}/dedi/${namespaceId}/create-registry`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            registry_name: createFormData.name.trim(),
            description: createFormData.description.trim(),
            schema: convertSchemaForAPI(parsedSchema),
            query_allowed: true,
            ...(Object.keys(parsedMeta).length > 0 && { meta: parsedMeta }),
          }),
        }
      );
      
      console.log('📊 Create registry response status:', response.status);
      console.log('📊 Create registry response headers:', response.headers);

      const result = await response.json();

      if (result.message === "Registry created") {
        toast({
          title: "Success",
          description: "Registry created successfully",
        });
        setIsCreateModalOpen(false);
        setCreateFormData({
          name: "",
          description: "",
          schema: "",
          metadata: "",
          meta: {},
        });
        setSchemaFields([{ key: "", type: "string" }]);
        setShowCreateMetadata(false);
        setShowSchemaBuilder(false);
        setSelectedSchemaType("blank");
        setShowSchemaBuilder(false);
        // Refresh the registries list
        await refreshRegistries();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create registry",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating registry:", error);
      toast({
        title: "Error",
        description: "Failed to create registry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenUpdateModal = (registry: Registry) => {
    setSelectedRegistry(registry);

    // Handle metadata properly - only show if it exists and has content
    let metaObj = {};
    let hasMetadata = false;
    if (
      registry.meta &&
      typeof registry.meta === "object" &&
      Object.keys(registry.meta).length > 0
    ) {
      // Check if meta has actual content (not just empty object)
      const hasContent = Object.values(registry.meta).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          (typeof value !== "object" || Object.keys(value).length > 0)
      );
      if (hasContent) {
        metaObj = registry.meta;
        hasMetadata = true;
      }
    }

    setUpdateFormData({
      name: registry.registry_name,
      description: registry.description,
      schema: "", // Remove schema from update form
      metadata: "",
      meta: metaObj,
    });
    setShowUpdateMetadata(hasMetadata);
    setIsUpdateModalOpen(true);
  };

  const handleUpdateRegistry = async () => {
    if (!selectedRegistry || updateLoading) return;

    try {
      setUpdateLoading(true);

      // Validate required fields
      if (!updateFormData.name.trim()) {
        toast({
          title: "Validation Error",
          description: "Registry name is required",
          variant: "destructive",
        });
        return;
      }

      if (!updateFormData.description.trim()) {
        toast({
          title: "Validation Error",
          description: "Description is required",
          variant: "destructive",
        });
        return;
      }

      // Parse metadata (optional)
      let parsedMeta = {};
      if (showUpdateMetadata && Object.keys(updateFormData.meta).length > 0) {
        parsedMeta = updateFormData.meta;
      }

      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/${namespaceId}/${selectedRegistry.registry_name}/update-registry`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: updateFormData.description.trim(),
            ...(Object.keys(parsedMeta).length > 0 && { meta: parsedMeta }),
          }),
        }
      );

      const result = await response.json();

      if (result.message === "Registry updated") {
        toast({
          title: "Success",
          description: "Registry updated successfully",
        });
        setIsUpdateModalOpen(false);
        setSelectedRegistry(null);
        // Refresh the registries list
        await refreshRegistries();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update registry",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating registry:", error);
      toast({
        title: "Error",
        description: "Failed to update registry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDelegateRegistry = async () => {
    if (!selectedRegistry || actionLoading) return;
    
    try {
      setActionLoading(true);
      
      // Validate required fields
      if (!delegateFormData.email.trim()) {
        toast({
          title: "Validation Error",
          description: "Email is required",
          variant: "destructive",
        });
        return;
      }

      // Cookie authentication is handled automatically by credentials: 'include'
      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/${namespaceId}/${selectedRegistry.registry_name}/add-delegate`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: delegateFormData.email.trim(),
          }),
        }
      );

      const result = await response.json();
      console.log("📝 Add delegate API response:", result);

      if (response.ok && result.message === "Delegate added successfully") {
        toast({
          title: "🎉 Success!",
          description: `Delegate "${delegateFormData.email}" added successfully to registry "${selectedRegistry.registry_name}".`,
          className: "border-green-200 bg-green-50 text-green-900",
        });
        
        // Close modal and reset form
        setIsDelegateModalOpen(false);
        setSelectedRegistry(null);
        setDelegateFormData({ email: "" });
        
        // Refresh the registries list to show updated delegate info
        await refreshRegistries();
      } else {
        console.error("❌ API Error:", result);
        toast({
          title: "Error",
          description: result.message || "Failed to add delegate",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding delegate:", error);
      toast({
        title: "Error",
        description: "Failed to add delegate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenArchiveAlert = (registry: Registry) => {
    setSelectedRegistry(registry);
    setIsArchiveAlertOpen(true);
  };

  const handleArchiveRegistry = async () => {
    if (!selectedRegistry) return;
    setActionLoading(true);
    try {
      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/${namespaceId}/${selectedRegistry.registry_name}/archive-registry`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (response.ok && result.message === "Registry has been archived") {
        toast({
          title: "🎉 Success!",
          description: `Registry "${selectedRegistry.registry_name}" archived successfully.`,
          className: "border-green-200 bg-green-50 text-green-900",
        });

        // Refresh the registries list to show updated status
        await refreshRegistries();
      } else {
        toast({
          title: "Archive Error",
          description: result.message || "Failed to archive registry",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error archiving registry:", error);
      toast({
        title: "Archive Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsArchiveAlertOpen(false);
      setSelectedRegistry(null);
      setActionLoading(false);
    }
  };

  const handleOpenRestoreAlert = (registry: Registry) => {
    setSelectedRegistry(registry);
    setIsRestoreAlertOpen(true);
  };

  const handleRestoreRegistry = async () => {
    if (!selectedRegistry) return;
    setActionLoading(true);
    try {
      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/${namespaceId}/${selectedRegistry.registry_name}/restore-registry`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (response.ok && result.message === "Registry has been restored") {
        toast({
          title: "🎉 Success!",
          description: `Registry "${selectedRegistry.registry_name}" restored successfully.`,
          className: "border-green-200 bg-green-50 text-green-900",
        });

        // Refresh the registries list to show updated status
        await refreshRegistries();
      } else {
        const errorMessage =
          result.message ||
          (response.status === 500
            ? "Internal Server Error"
            : "Failed to restore registry");
        toast({
          title: "Restore Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error restoring registry:", error);
      toast({
        title: "Restore Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRestoreAlertOpen(false);
      setSelectedRegistry(null);
      setActionLoading(false);
    }
  };

  const handleOpenRevokeAlert = (registry: Registry) => {
    setSelectedRegistry(registry);
    setIsRevokeAlertOpen(true);
  };

  const handleRevokeRegistry = async () => {
    if (!selectedRegistry) return;
    setActionLoading(true);
    try {
      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/${namespaceId}/${selectedRegistry.registry_name}/revoke-registry`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "🎉 Success!",
          description: `Registry "${selectedRegistry.registry_name}" revoked successfully.`,
          className: "border-green-200 bg-green-50 text-green-900",
        });

        // Refresh the registries list to show updated status
        await refreshRegistries();
      } else {
        toast({
          title: "Revoke Error",
          description: result.message || "Failed to revoke registry",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error revoking registry:", error);
      toast({
        title: "Revoke Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRevokeAlertOpen(false);
      setSelectedRegistry(null);
      setActionLoading(false);
    }
  };

  const handleOpenReinstateAlert = (registry: Registry) => {
    setSelectedRegistry(registry);
    setIsReinstateAlertOpen(true);
  };

  const handleReinstateRegistry = async () => {
    if (!selectedRegistry) return;
    setActionLoading(true);
    try {
      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(
        `${API_BASE_URL}/dedi/${namespaceId}/${selectedRegistry.registry_name}/reinstate-registry`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const result = await response.json();

      if (response.ok && result.message === "Registry has been reinstated") {
        toast({
          title: "🎉 Success!",
          description: `Registry "${selectedRegistry.registry_name}" reinstated successfully.`,
          className: "border-green-200 bg-green-50 text-green-900",
        });

        // Refresh the registries list to show updated status
        await refreshRegistries();
      } else {
        toast({
          title: "Reinstate Error",
          description: result.message || "Failed to reinstate registry",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error reinstating registry:", error);
      toast({
        title: "Reinstate Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReinstateAlertOpen(false);
      setSelectedRegistry(null);
      setActionLoading(false);
    }
  };

  const handleBulkUpload = async () => {
    if (uploadLoading) return; // Prevent multiple submissions

    try {
      if (!selectedFiles || selectedFiles.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one file to upload",
          variant: "destructive",
        });
        return;
      }

      // Cookie authentication is handled automatically by credentials: 'include'

      setUploadLoading(true);
      setUploadProgress(["Starting upload..."]);
      setUploadProgressPercent(0);
      setProcessedFiles(0);
      setTotalFiles(selectedFiles.length);
      setCompletedFileNames(new Set());
      // Set global upload status
      setGlobalUploadStatus({
        isUploading: true,
        message: `Starting upload of ${selectedFiles.length} file(s)...`,
        namespaceId: namespaceId || "",
        progress: 0,
      });

      // Create FormData
      const formData = new FormData();
      formData.append("namespace", namespaceId || "");

      // Add all selected files
      Array.from(selectedFiles).forEach((file) => {
        formData.append("file", file);
      });

      const API_BASE_URL =
        import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      const response = await fetch(`${API_BASE_URL}/dedi/bulk-upload`, {
        method: "POST",
        credentials: "include",
        headers: {},
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: BulkUploadInitialResponse = await response.json();
      console.log("📤 Initial upload response:", result);

      if (
        result.status === "success" &&
        result.message === "Bulk upload job started successfully"
      ) {
        // Show initial success toast
        toast({
          title: "🚀 Bulk Upload Started!",
          description:
            "Your files are being processed. You'll be notified as each file completes.",
          className: "border-blue-200 bg-blue-50 text-blue-900",
          duration: 3000,
        });

        // Set the job ID to start polling
        setUploadJobId(result.data.jobId);
        setTotalFiles(result.data.totalFiles);

        // Initialize progress immediately
        setUploadProgressPercent(0);
        setProcessedFiles(0);

        // Update progress log
        setUploadProgress((prev) => [
          ...prev,
          `Job started with ID: ${result.data.jobId}`,
          `Processing ${result.data.totalFiles} files...`,
        ]);

        // Update global status with initial progress
        setGlobalUploadStatus((prev) =>
          prev
            ? {
                ...prev,
                message: `Processing ${result.data.totalFiles} files... 0/${result.data.totalFiles} completed`,
                progress: 0,
              }
            : null
        );

        // Note: uploadLoading stays true to keep the modal in processing state
        // The polling useEffect will handle the rest
      } else {
        throw new Error(result.message || "Failed to start bulk upload job");
      }
    } catch (error) {
      console.error("Error starting bulk upload:", error);
      setGlobalUploadStatus(null); // Clear global status on error
      setUploadLoading(false);
      setUploadJobId(null);

      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start bulk upload. Please try again.",
        variant: "destructive",
        duration: 7000,
      });
      setUploadProgress((prev) => [
        ...prev,
        "Upload failed to start. Please try again.",
      ]);
    }
  };

  const handleRegistryClick = (registry: Registry) => {
    navigate(`/${namespaceId}/${registry.registry_name}`);
  };

  const addSchemaField = () => {
    setSchemaFields((prev) => [...prev, { key: "", type: "string" }]);
  };

  const removeSchemaField = (index: number) => {
    setSchemaFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSchemaField = (
    index: number,
    field: "key" | "type",
    value: string
  ) => {
    setSchemaFields((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleCreateMetaChange = (key: string, value: unknown) => {
    setCreateFormData((prev) => ({
      ...prev,
      meta: {
        ...prev.meta,
        [key]: value,
      },
    }));
  };

  const handleUpdateMetaChange = (key: string, value: unknown) => {
    setUpdateFormData((prev) => ({
      ...prev,
      meta: {
        ...prev.meta,
        [key]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading registries...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Global Upload Progress Notification */}
      {globalUploadStatus?.isUploading && (
        <div className="fixed top-4 right-4 z-50 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md shadow-lg max-w-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
            <div className="ml-3 w-full">
              <p className="text-sm font-medium text-blue-800">
                Bulk Upload in Progress
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {globalUploadStatus.message}
              </p>
              {typeof globalUploadStatus.progress === "number" && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-blue-600 mb-1">
                    <span>Progress</span>
                    <span>{globalUploadStatus.progress}%</span>
                  </div>
                  <Progress
                    value={globalUploadStatus.progress}
                    className="h-2"
                  />
                </div>
              )}
              <p className="text-xs text-blue-500 mt-1">
                You'll be notified when complete
              </p>
              {globalUploadStatus.progress === 100 ? (
                <button
                  onClick={() => setGlobalUploadStatus(null)}
                  className="text-xs text-blue-700 hover:text-blue-900 mt-2 underline"
                >
                  Dismiss
                </button>
              ) : (
                <p className="text-xs text-gray-500 mt-2 italic">
                  Processing... cannot dismiss yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{namespaceName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Your Registries</h1>
        <p className="text-muted-foreground mt-2">
          Manage and organize your registries in this namespace (
          {totalRegistries} total registries,{" "}
          {registries.filter((r) => !r.is_revoked && !r.is_archived).length}{" "}
          active registries)
        </p>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div className="flex gap-4">
          <Button
            onClick={() => {
              setIsCreateModalOpen(true);
              setSelectedSchemaType("blank");
              setShowSchemaBuilder(false);
              setCreateFormData({
                name: "",
                description: "",
                schema: "",
                metadata: "",
                meta: {},
              });
              setSchemaFields([{ key: "", type: "string" }]);
              setShowCreateMetadata(false);
            }}
            className="px-8 py-6 text-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Registry
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsBulkUploadModalOpen(true)}
            className="px-8 py-6 text-lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/namespaces/${namespaceId}/revoked`)}
          className="px-8 py-6 text-lg relative"
        >
          <Ban className="mr-2 h-4 w-4" />
          Revoked Registries
          {revokedRegistriesCount > 0 && (
            <Badge variant="destructive" className="ml-2 px-2 py-1 text-xs">
              {revokedRegistriesCount}
            </Badge>
          )}
        </Button>
      </div>

      {registries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-lg font-medium mb-2">No registries found</div>
          <p className="text-muted-foreground">
            Get started by creating your first registry
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {registries.map((registry) => (
            <Card
              key={registry.registry_id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleRegistryClick(registry)}
            >
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate">
                    {registry.registry_name}
                  </CardTitle>
                  <CardDescription>{registry.description}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button variant="ghost" size="icon" className="ml-auto">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={() => handleOpenUpdateModal(registry)}
                    >
                      Update
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedRegistry(registry);
                        setIsDelegateModalOpen(true);
                      }}
                    >
                      Delegate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {registry.is_archived ? (
                      <DropdownMenuItem
                        onClick={() => handleOpenRestoreAlert(registry)}
                        className="text-green-600 focus:text-green-600 focus:bg-green-50"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleOpenArchiveAlert(registry)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    {registry.is_revoked ? (
                      <DropdownMenuItem
                        onClick={() => handleOpenReinstateAlert(registry)}
                        className="text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Reinstate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleOpenRevokeAlert(registry)}
                        className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Revoke
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Created:{" "}
                    {new Date(registry.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Updated:{" "}
                    {new Date(registry.updated_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Records: {registry.record_count || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Records: {registry.record_count || 0}
                  </p>
                </div>
                {(registry.is_archived || registry.is_revoked) && (
                  <div className="mt-2 flex gap-2">
                    {registry.is_archived && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Archive className="mr-1 h-3 w-3" />
                        Archived
                      </span>
                    )}
                    {registry.is_revoked && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <Ban className="mr-1 h-3 w-3" />
                        Revoked
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Registry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={createFormData.name}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow alphanumeric characters, hyphens, and underscores
                  const filteredValue = value.replace(/[^a-zA-Z0-9_-]/g, "");
                  setCreateFormData({ ...createFormData, name: filteredValue });
                }}
                placeholder="Enter registry name (alphanumeric, _, - only)"
              />
              <p className="text-xs text-muted-foreground">
                Only letters, numbers, underscores (_), and hyphens (-) are
                allowed
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description *</Label>
              <Textarea
                id="create-description"
                value={createFormData.description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 200) {
                    setCreateFormData({
                      ...createFormData,
                      description: value,
                    });
                  }
                }}
                placeholder="Enter registry description"
                rows={3}
                maxLength={200}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">
                  Maximum 200 characters
                </span>
                <span
                  className={`${
                    createFormData.description.length > 180
                      ? "text-red-500"
                      : createFormData.description.length > 160
                      ? "text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {createFormData.description.length}/200
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <Label>Schema *</Label>
              {/* Schema Type Selection */}
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(schemaConfigs).map(([key, config]) => {
                  const IconComponent = config.icon;
                  return (
                    <div
                      key={key}
                      className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all hover:border-primary hover:shadow-md relative ${
                        selectedSchemaType === key
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-gray-200 hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setSelectedSchemaType(key);
                        if (key === "blank") {
                          setShowSchemaBuilder(true);
                        } else {
                          setShowSchemaBuilder(false);
                        }
                      }}
                    >
                      {/* Info icon with tooltip for predefined schemas */}
                      {config.schema && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full">
                                <Info className="h-3 w-3 text-gray-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-2">
                                <p className="font-semibold">
                                  {config.name} Schema
                                </p>
                                <p className="text-sm">{config.tooltip}</p>
                                <div className="mt-2">
                                  <p className="text-xs font-medium mb-1">
                                    Fields:
                                  </p>
                                  <div className="text-xs space-y-1">
                                    {Object.entries(
                                      extractSchemaProperties(config.schema)
                                    ).map(([fieldKey, fieldValue]) => {
                                      if (
                                        typeof fieldValue === "object" &&
                                        fieldValue.type === "array" &&
                                        fieldValue.itemProperties
                                      ) {
                                        return (
                                          <div
                                            key={fieldKey}
                                            className="border-l-2 border-gray-300 pl-2 space-y-1"
                                          >
                                            <div className="flex justify-between">
                                              <span className="font-mono font-semibold">
                                                {fieldKey}:
                                              </span>
                                              <span className="text-gray-600">
                                                array
                                              </span>
                                            </div>
                                            <div className="ml-2 space-y-1">
                                              {Object.entries(
                                                fieldValue.itemProperties
                                              ).map(([itemKey, itemType]) => (
                                                <div
                                                  key={itemKey}
                                                  className="flex justify-between"
                                                >
                                                  <span className="font-mono text-gray-500">
                                                    {" "}
                                                    └ {itemKey}:
                                                  </span>
                                                  <span className="text-gray-600">
                                                    {String(itemType)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      }
                                      return (
                                        <div
                                          key={fieldKey}
                                          className="flex justify-between"
                                        >
                                          <span className="font-mono">
                                            {fieldKey}:
                                          </span>
                                          <span className="text-gray-600">
                                            {String(fieldValue)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      <div
                        className={`w-12 h-12 mx-auto mb-2 ${config.color} rounded-lg flex items-center justify-center`}
                      >
                        <IconComponent
                          className={`h-6 w-6 ${config.iconColor}`}
                        />
                      </div>
                      <p className="text-sm font-medium">{config.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {config.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Schema Builder - Only show for Blank Schema */}
              {selectedSchemaType === "blank" && showSchemaBuilder && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Schema Fields</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSchemaField}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {schemaFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Field name (alphanumeric, _, - only)"
                          value={field.key}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow alphanumeric characters, hyphens, and underscores
                            const filteredValue = value.replace(
                              /[^a-zA-Z0-9_-]/g,
                              ""
                            );
                            updateSchemaField(index, "key", filteredValue);
                          }}
                          className="flex-1"
                        />
                        <Select
                          value={field.type}
                          onValueChange={(value) =>
                            updateSchemaField(index, "type", value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">string</SelectItem>
                            <SelectItem value="integer">integer</SelectItem>
                            <SelectItem value="float">float</SelectItem>
                            <SelectItem value="boolean">boolean</SelectItem>
                          </SelectContent>
                        </Select>
                        {schemaFields.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeSchemaField(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview for other schema types */}
              {selectedSchemaType !== "blank" && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <div className="text-center mb-3">
                    <p className="text-sm font-medium text-gray-700">
                      {
                        schemaConfigs[
                          selectedSchemaType as keyof typeof schemaConfigs
                        ]?.name
                      }{" "}
                      schema will be applied
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {
                        schemaConfigs[
                          selectedSchemaType as keyof typeof schemaConfigs
                        ]?.description
                      }
                    </p>
                  </div>

                  {/* Show schema fields preview only */}
                  {schemaConfigs[
                    selectedSchemaType as keyof typeof schemaConfigs
                  ]?.schema && (
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-gray-600">
                        Schema Fields Preview:
                      </p>
                      <div className="space-y-2">
                        {Object.entries(
                          extractSchemaProperties(
                            schemaConfigs[
                              selectedSchemaType as keyof typeof schemaConfigs
                            ].schema!
                          )
                        ).map(([key, value]) => {
                          // For array fields, just show the field type without input controls
                          if (
                            typeof value === "object" &&
                            value.type === "array" &&
                            value.itemProperties
                          ) {
                            return (
                              <div
                                key={key}
                                className="border rounded-lg p-3 bg-white"
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium text-sm text-gray-700">
                                    {key}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    array
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-500 ml-2">
                                  <p className="font-medium mb-1">
                                    Array item fields:
                                  </p>
                                  {Object.entries(value.itemProperties).map(
                                    ([itemKey, itemType]) => (
                                      <div
                                        key={itemKey}
                                        className="flex justify-between py-1"
                                      >
                                        <span className="font-mono">
                                          • {itemKey}:
                                        </span>
                                        <span className="text-gray-600">
                                          {String(itemType)}
                                        </span>
                                      </div>
                                    )
                                  )}
                                  <p className="text-xs text-blue-600 mt-2 italic">
                                    Array items will be managed when creating
                                    records
                                  </p>
                                </div>
                              </div>
                            );
                          } else {
                            // Regular field preview
                            return (
                              <div
                                key={key}
                                className="flex justify-between items-center px-3 py-2 bg-white rounded border text-sm"
                              >
                                <span className="font-mono text-gray-700">
                                  {key}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {String(value)}
                                </Badge>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                  {Object.keys(createFormData.meta).map((key, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-2 gap-2"
                    >
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const value = createFormData.meta[key];
                          setCreateFormData((prev) => {
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
                            typeof createFormData.meta[key] === "string"
                              ? createFormData.meta[key]
                              : JSON.stringify(createFormData.meta[key])
                          }
                          onChange={(e) => {
                            let value: unknown = e.target.value;
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
                            handleCreateMetaChange(key, value);
                          }}
                          placeholder="value"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setCreateFormData((prev) => {
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
                      setCreateFormData((prev) => ({
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
              onClick={handleCreateRegistry}
              disabled={createLoading}
            >
              {createLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Registry</DialogTitle>
            {selectedRegistry && (
              <DialogDescription>
                Updating {selectedRegistry.registry_name}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="update-name">Name *</Label>
              <Input
                id="update-name"
                value={updateFormData.name}
                readOnly
                disabled
                className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                placeholder="Registry name cannot be changed"
              />
              <p className="text-xs text-muted-foreground">
                Registry name cannot be modified after creation
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-description">Description *</Label>
              <Textarea
                id="update-description"
                value={updateFormData.description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 200) {
                    setUpdateFormData({
                      ...updateFormData,
                      description: value,
                    });
                  }
                }}
                placeholder="Enter registry description"
                rows={3}
                maxLength={200}
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">
                  Maximum 200 characters
                </span>
                <span
                  className={`${
                    updateFormData.description.length > 180
                      ? "text-red-500"
                      : updateFormData.description.length > 160
                      ? "text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {updateFormData.description.length}/200
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
                  {Object.keys(updateFormData.meta).map((key, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-2 gap-2"
                    >
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const value = updateFormData.meta[key];
                          setUpdateFormData((prev) => {
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
                            typeof updateFormData.meta[key] === "string"
                              ? updateFormData.meta[key]
                              : JSON.stringify(updateFormData.meta[key])
                          }
                          onChange={(e) => {
                            let value: unknown = e.target.value;
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
                            handleUpdateMetaChange(key, value);
                          }}
                          placeholder="value"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setUpdateFormData((prev) => {
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
                      setUpdateFormData((prev) => ({
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
              onClick={handleUpdateRegistry}
              disabled={updateLoading}
            >
              {updateLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                "Update Registry"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDelegateModalOpen} onOpenChange={setIsDelegateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delegate Registry Access</DialogTitle>
            {selectedRegistry && (
              <DialogDescription>
                For registry: {selectedRegistry.registry_name}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delegate-email">Email</Label>
              <Input
                id="delegate-email"
                type="email"
                value={delegateFormData.email}
                onChange={(e) =>
                  setDelegateFormData({
                    ...delegateFormData,
                    email: e.target.value,
                  })
                }
                placeholder="Enter user's email"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDelegateModalOpen(false);
                  setSelectedRegistry(null);
                  setDelegateFormData({ email: "" });
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDelegateRegistry}
                disabled={actionLoading || !delegateFormData.email.trim()}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding Delegate...
                  </>
                ) : (
                  'Delegate'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isArchiveAlertOpen}
        onOpenChange={setIsArchiveAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to archive this registry?
            </AlertDialogTitle>
            {selectedRegistry && (
              <AlertDialogDescription>
                This action will archive the registry "
                {selectedRegistry.registry_name}". You may be able to unarchive
                it later, but it will be hidden from normal view.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSelectedRegistry(null)}
              disabled={actionLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveRegistry}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Archiving...
                </>
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isRestoreAlertOpen}
        onOpenChange={setIsRestoreAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to restore this registry?
            </AlertDialogTitle>
            {selectedRegistry && (
              <AlertDialogDescription>
                This action will restore the registry "
                {selectedRegistry.registry_name}", making it active again.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSelectedRegistry(null)}
              disabled={actionLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreRegistry}
              className="bg-green-600 hover:bg-green-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isRevokeAlertOpen} onOpenChange={setIsRevokeAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to revoke this registry?
            </AlertDialogTitle>
            {selectedRegistry && (
              <AlertDialogDescription>
                This action will revoke the registry "
                {selectedRegistry.registry_name}". This will make the registry
                inactive and prevent its use.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSelectedRegistry(null)}
              disabled={actionLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeRegistry}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Revoking...
                </>
              ) : (
                "Revoke"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isReinstateAlertOpen}
        onOpenChange={setIsReinstateAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to reinstate this registry?
            </AlertDialogTitle>
            {selectedRegistry && (
              <AlertDialogDescription>
                This action will reinstate the registry "
                {selectedRegistry.registry_name}", making it active again.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setSelectedRegistry(null)}
              disabled={actionLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReinstateRegistry}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Reinstating...
                </>
              ) : (
                "Reinstate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isBulkUploadModalOpen}
        onOpenChange={(open) => {
          // Allow closing the modal even during upload
          if (!open) {
            setIsBulkUploadModalOpen(false);
            if (!uploadLoading) {
              setUploadProgress([]);
              setSelectedFiles(null);
              setUploadProgressPercent(0);
              setProcessedFiles(0);
              setTotalFiles(0);
              setCompletedFileNames(new Set());
            }
          } else {
            setIsBulkUploadModalOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload</DialogTitle>
            <DialogDescription>
              Upload multiple files to create registries in bulk
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-upload-files">Select Files</Label>
              <Input
                id="bulk-upload-files"
                type="file"
                multiple
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => setSelectedFiles(e.target.files)}
                className="cursor-pointer"
                disabled={uploadLoading}
              />
              {selectedFiles && selectedFiles.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedFiles.length} file(s) selected
                </p>
              )}
            </div>
            {(uploadLoading || uploadProgressPercent > 0) && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Progress</Label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Files processed:</span>
                      <span>
                        {processedFiles} / {totalFiles}
                      </span>
                    </div>
                    <Progress value={uploadProgressPercent} className="h-3" />
                    <div className="text-center text-sm text-muted-foreground">
                      {uploadProgressPercent}% Complete
                    </div>
                  </div>
                </div>
                {uploadProgress.length > 0 && (
                  <div className="space-y-2">
                    <Label>Activity Log</Label>
                    <div className="max-h-32 overflow-y-auto bg-gray-50 p-3 rounded-md text-sm">
                      {uploadProgress.map((message, index) => (
                        <div key={index} className="text-gray-700 mb-1">
                          {message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadLoading ? (
                  <p className="text-sm text-blue-600">
                    ℹ️ You can close this modal and continue working. Upload
                    will continue in the background.
                  </p>
                ) : uploadProgressPercent === 100 ? (
                  <p className="text-sm text-green-600">
                    ✅ Upload completed successfully! You can now close this
                    modal.
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex gap-2">
              {!uploadLoading && uploadProgressPercent === 100 ? (
                // Show close button when upload is completed
                <Button
                  onClick={() => {
                    setIsBulkUploadModalOpen(false);
                    setUploadProgress([]);
                    setSelectedFiles(null);
                    setUploadProgressPercent(0);
                    setProcessedFiles(0);
                    setTotalFiles(0);
                    setCompletedFileNames(new Set());
                    setGlobalUploadStatus(null); // Clear global status when modal is closed
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsBulkUploadModalOpen(false);
                      if (!uploadLoading) {
                        setUploadProgress([]);
                        setSelectedFiles(null);
                        setUploadProgressPercent(0);
                        setProcessedFiles(0);
                        setTotalFiles(0);
                        setCompletedFileNames(new Set());
                        setGlobalUploadStatus(null);
                      }
                      // If upload is in progress, keep the global status for background monitoring
                    }}
                    className="flex-1"
                  >
                    {uploadLoading ? "Continue Working" : "Cancel"}
                  </Button>
                  <Button
                    onClick={handleBulkUpload}
                    disabled={
                      uploadLoading ||
                      !selectedFiles ||
                      selectedFiles.length === 0
                    }
                    className="flex-1"
                  >
                    {uploadLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      "Upload"
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
