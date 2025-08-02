import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, AlertCircle, CheckCircle, Info, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Interface for breadcrumb API response
interface BreadcrumbApiResponse {
  message: string;
  data: {
    namespace_id: string;
    namespace_name: string;
    registry_name: string;
    registry_id: string;
  };
}

// Interface for record details API response
interface RecordDetailsApiResponse {
  message: string;
  data: {
    namespace: string;
    namespace_id: string;
    registry_id: string;
    registry_name: string;
    record_id: string | null;
    record_name: string;
    description: string;
    digest: string;
    schema: { [key: string]: unknown };
    version_count: number;
    version: string;
    details: { [key: string]: string };
    meta: unknown;
    genesis: string;
    created_at: string;
    updated_at: string;
    created_by: string;
    state: string;
    ttl: number;
  };
}

// Interface for update record form data
interface UpdateRecordFormData {
  // new_record_name: string;
  description: string;
  details: { [key: string]: string };
  meta: { [key: string]: string };
}

// Utility function to trim long values (first 7 chars + ... + last 5 chars)
const trimValue = (value: string, firstChars: number = 7, lastChars: number = 5): string => {
  if (!value || value.length <= firstChars + lastChars + 3) {
    return value;
  }
  return `${value.substring(0, firstChars)}...${value.substring(value.length - lastChars)}`;
};

// Component for displaying trimmed value with copy button
const TrimmedValueWithCopy = ({ label, value, className = "" }: { label: string; value: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className={className}>
      <h3 className="font-medium text-sm text-muted-foreground">{label}</h3>
      <div className="flex items-center">
        <p className="text-sm font-mono break-all">{trimValue(value)}</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-1 shrink-0"
          onClick={handleCopy}
          title={`Copy ${label.toLowerCase()}`}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      {copied && (
        <p className="text-xs text-green-600 mt-1">Copied!</p>
      )}
    </div>
  );
};

// Helper component for Schema Information
const SchemaInfoCard = ({ schema }: { schema: { [key: string]: unknown } }) => (
  <Card>
    <CardHeader>
      <CardTitle>Schema</CardTitle>
      <CardDescription>
        Data structure definition for this record
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid gap-4">
        {Object.entries(schema).map(([field, type]) => (
          <div key={field} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <div className="font-medium text-sm text-muted-foreground mb-1 sm:mb-0">
              {field}
            </div>
            <div className="text-sm font-mono">
              {String(type)}
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export function RecordDetailsPage(): JSX.Element {
  const { namespaceId, registryName, recordName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [breadcrumbData, setBreadcrumbData] = useState<BreadcrumbApiResponse['data'] | null>(null);
  const [recordDetails, setRecordDetails] = useState<RecordDetailsApiResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordLoading, setRecordLoading] = useState(true);
  const [isPublishAlertOpen, setIsPublishAlertOpen] = useState(false);
  const [isSuspendAlertOpen, setIsSuspendAlertOpen] = useState(false);
  const [isRevokeAlertOpen, setIsRevokeAlertOpen] = useState(false);
  const [isReinstateAlertOpen, setIsReinstateAlertOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [reinstateLoading, setReinstateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateFormData, setUpdateFormData] = useState<UpdateRecordFormData>({
    // new_record_name: '',
    description: '',
    details: {},
    meta: {},
  });

  const fetchRecordDetails = useCallback(async () => {
    try {
      console.log('🔄 Fetching record details...');
      console.log('📍 Parameters:', { namespaceId, registryName, recordName });
      setRecordLoading(true);
      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      // Properly encode URL parameters
      const encodedNamespace = namespaceId || '';
      const encodedRegistry = registryName || '';
      const encodedRecord = recordName || '';
      
      const apiUrl = `${API_BASE_URL}/dedi/lookup/${encodedNamespace}/${encodedRegistry}/${encodedRecord}`;
      console.log('🌐 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: RecordDetailsApiResponse = await response.json();
      console.log('Record details API response:', result);
      
      if (result.message === "Resource retrieved successfully") {
        setRecordDetails(result.data);
        // Set breadcrumb data from record details instead of separate API call
        setBreadcrumbData({
          namespace_id: result.data.namespace_id,
          namespace_name: result.data.namespace || 'Namespace',
          registry_name: result.data.registry_name,
          registry_id: result.data.registry_id,
        });
      } else {
        console.error('Failed to fetch record details:', result.message);
        toast({
          title: 'Error',
          description: result.message || 'Failed to fetch record details',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching record details:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch record details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRecordLoading(false);
      setLoading(false);
    }
  }, [namespaceId, registryName, recordName, toast]);

  useEffect(() => {
    if (namespaceId && registryName && recordName) {
      fetchRecordDetails();
    }
  }, [namespaceId, registryName, recordName, fetchRecordDetails]);

  const handleOpenUpdateModal = () => {
    if (!recordDetails) return;
    
    // Populate form with current record data
    setUpdateFormData({
      // new_record_name: recordDetails.record_name,
      description: recordDetails.description,
      details: { ...recordDetails.details },
      meta: recordDetails.meta && typeof recordDetails.meta === 'object' ? { ...recordDetails.meta } : {},
    });
    setIsUpdateModalOpen(true);
  };

  const handleUpdateRecord = async () => {
    if (updateLoading) return; // Prevent multiple submissions
    
    try {
      setUpdateLoading(true);
      
      // Validate required fields
      if (!updateFormData.description.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Description is required',
          variant: 'destructive',
        });
        return;
      }

      // Cookie authentication is handled automatically by credentials: 'include'

      // Convert details based on schema types
      const typedDetails: { [key: string]: unknown } = {};
      if (recordDetails) {
        Object.keys(recordDetails.schema).forEach(field => {
          const value = updateFormData.details[field];
          const type = recordDetails.schema[field];
          
          if (value !== undefined && value !== '') {
            const fieldType = (typeof type === 'string' ? type.toLowerCase() : 'string');
            switch (fieldType) {
              case 'integer':
              case 'int':
                { const intValue = parseInt(value, 10);
                if (!isNaN(intValue)) {
                  typedDetails[field] = intValue;
                }
                break; }
              case 'float':
              case 'double':
              case 'number':
                { const floatValue = parseFloat(value);
                if (!isNaN(floatValue)) {
                  typedDetails[field] = floatValue;
                }
                break; }
              case 'boolean':
              case 'bool':
                typedDetails[field] = value === 'true' || value === '1';
                break;
              case 'string':
              default:
                typedDetails[field] = value;
                break;
            }
          }
        });
      }

      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      // Properly encode URL parameters
      const currentNamespaceId = namespaceId || '';
      const currentRegistryName = registryName || '';
      
      const requestBody = {
        description: updateFormData.description.trim(),
        details: typedDetails,
        ...(Object.keys(updateFormData.meta).length > 0 && { meta: updateFormData.meta }),
      };

      console.log('Update request body:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/dedi/${currentNamespaceId}/${currentRegistryName}/${recordName}/update-record`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      console.log('Update API response:', result);

      if (response.ok) {
        // If response is successful (200-299), show success toast
        toast({
          title: 'Success',
          description: result.message || 'Record updated successfully',
        });
        setIsUpdateModalOpen(false);
        
        // Refresh record details to show updated data
        await fetchRecordDetails();
      } else {
        // Only show error toast for non-successful responses
        toast({
          title: 'Error',
          description: result.message || 'Failed to update record',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating record:', error);
      toast({
        title: 'Error',
        description: 'Failed to update record. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDetailsChange = (key: string, value: string) => {
    setUpdateFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        [key]: value,
      },
    }));
  };

  const handleMetaChange = (key: string, value: string) => {
    setUpdateFormData(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        [key]: value,
      },
    }));
  };

  const handleOpenPublishAlert = () => {
    setIsPublishAlertOpen(true);
  };

  const handlePublishRecord = async () => {
    if (publishLoading) return; // Prevent multiple submissions
    
    try {
      setPublishLoading(true);
      
      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      const currentNamespaceId = namespaceId || '';
      const currentRegistryName = registryName || '';
      const currentRecordName = recordName || '';
      
      const response = await fetch(`${API_BASE_URL}/dedi/${currentNamespaceId}/${currentRegistryName}/${currentRecordName}/publish-record`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      console.log('Publish API response:', result);

      if (response.ok && result.message === "Record published") {
        toast({
          title: 'Success',
          description: 'Record published successfully',
        });
        setIsPublishAlertOpen(false);
        await fetchRecordDetails();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to publish record',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error publishing record:', error);
      toast({
        title: 'Error',
        description: 'Failed to publish record. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPublishLoading(false);
    }
  };

  const handleOpenSuspendAlert = () => {
    setIsSuspendAlertOpen(true);
  };

  const handleSuspendRecord = async () => {
    if (suspendLoading) return; // Prevent multiple submissions
    
    try {
      setSuspendLoading(true);
      
      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      const currentNamespaceId = namespaceId || '';
      const currentRegistryName = registryName || '';
      const currentRecordName = recordName || '';
      
      const response = await fetch(`${API_BASE_URL}/dedi/${currentNamespaceId}/${currentRegistryName}/${currentRecordName}/suspend-record`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      console.log('Suspend API response:', result);

      if (response.ok && result.message === "Record has been suspended") {
        toast({
          title: 'Success',
          description: 'Record suspended successfully',
        });
        setIsSuspendAlertOpen(false);
        await fetchRecordDetails();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to suspend record',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error suspending record:', error);
      toast({
        title: 'Error',
        description: 'Failed to suspend record. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleOpenRevokeAlert = () => {
    setIsRevokeAlertOpen(true);
  };

  const handleRevokeRecord = async () => {
    if (revokeLoading) return; // Prevent multiple submissions
    
    try {
      setRevokeLoading(true);
      
      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      // Properly encode URL parameters
      const currentNamespaceId = namespaceId || '';
      const currentRegistryName = registryName || '';
      const currentRecordName = recordName || '';
      
      console.log('Revoke API URL:', `${API_BASE_URL}/dedi/${currentNamespaceId}/${currentRegistryName}/${currentRecordName}/revoke-record`);
      
      const response = await fetch(`${API_BASE_URL}/dedi/${currentNamespaceId}/${currentRegistryName}/${currentRecordName}/revoke-record`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      console.log('Revoke API response:', result);

      if (response.ok && result.message === "Record has been archived") {
        toast({
          title: 'Success',
          description: 'Record revoked successfully',
        });
        setIsRevokeAlertOpen(false);
        // Refresh record details to show updated status
        await fetchRecordDetails();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to revoke record',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking record:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke record. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRevokeLoading(false);
    }
  };



  const handleOpenReinstateAlert = () => {
    setIsReinstateAlertOpen(true);
  };

  const handleReinstateRecord = async () => {
    if (reinstateLoading) return; // Prevent multiple submissions
    
    try {
      setReinstateLoading(true);
      
      // Cookie authentication is handled automatically by credentials: 'include'

      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      // Properly encode URL parameters
      const currentNamespaceId = namespaceId || '';
      const currentRegistryName = registryName || '';
      const currentRecordName = recordName || '';
      
      console.log('Reinstate API URL:', `${API_BASE_URL}/dedi/${currentNamespaceId}/${currentRegistryName}/${currentRecordName}/reinstate-record`);
      
      const response = await fetch(`${API_BASE_URL}/dedi/${currentNamespaceId}/${currentRegistryName}/${currentRecordName}/reinstate-record`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      console.log('Reinstate API response:', result);

      if (response.ok && (result.message === "Record reinstated successfully" || result.message === "Record has been reinstated")) {
        toast({
          title: 'Success',
          description: 'Record reinstated successfully',
        });
        setIsReinstateAlertOpen(false);
        // Refresh record details to show updated status
        await fetchRecordDetails();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to reinstate record',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error reinstating record:', error);
      toast({
        title: 'Error',
        description: 'Failed to reinstate record. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReinstateLoading(false);
    }
  };

  const getStatusDisplay = () => {
    if (!recordDetails) return 'Unknown';
    
    // Use the state field from the API response
    switch (recordDetails.state) {
      case 'draft':
        return 'Draft';
      case 'live':
        return 'Live';
      case 'suspended':
        return 'Suspended';
      case 'revoked':
        return 'Revoked';
      case 'expired':
        return 'Expired';
      default:
        return recordDetails.state || 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (!recordDetails) return 'text-gray-500';
    
    switch (recordDetails.state) {
      case 'draft':
        return 'text-yellow-600';
      case 'live':
        return 'text-green-600';
      case 'suspended':
        return 'text-orange-600';
      case 'revoked':
        return 'text-red-600';
      case 'expired':
        return 'text-gray-600';
      default:
        return 'text-gray-500';
    }
  };

  // Function to render dropdown menu items based on record state
  const renderDropdownMenuItems = () => {
    if (!recordDetails) return null;

    const state = recordDetails.state;
    
    // If expired, show no action buttons
    if (state === 'expired') {
      return null;
    }

    const items = [];

    // Only show Update button for draft and live states
    if (state === 'draft' || state === 'live') {
      items.push(
        <DropdownMenuItem key="update" onClick={handleOpenUpdateModal}>
          Update
        </DropdownMenuItem>
      );
      items.push(<DropdownMenuSeparator key="separator" />);
    }

    // State-specific buttons
    if (state === 'draft') {
      // Draft state: show Publish button
      items.push(
        <DropdownMenuItem 
          key="publish" 
          onClick={handleOpenPublishAlert} 
          className="text-green-600 focus:text-green-600 focus:bg-green-50"
        >
          Publish
        </DropdownMenuItem>
      );
    } else if (state === 'live') {
      // Live state: show Suspend and Revoke buttons
      items.push(
        <DropdownMenuItem 
          key="suspend" 
          onClick={handleOpenSuspendAlert} 
          className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
        >
          Suspend
        </DropdownMenuItem>
      );
      items.push(
        <DropdownMenuItem 
          key="revoke" 
          onClick={handleOpenRevokeAlert} 
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          Revoke
        </DropdownMenuItem>
      );
    } else if (state === 'suspended') {
      // Suspended state: show Reinstate button
      items.push(
        <DropdownMenuItem 
          key="reinstate" 
          onClick={handleOpenReinstateAlert} 
          className="text-blue-600 focus:text-blue-600 focus:bg-blue-50"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Reinstate
        </DropdownMenuItem>
      );
    }
    // Note: revoked state shows no additional buttons (revoke is permanent)

    return items;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      console.error(error);
      return dateString;
    }
  };

  // Show loading state
  if (loading || recordLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading record details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if record details couldn't be loaded
  if (!recordDetails) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="mx-auto h-32 w-32 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to load record</h3>
            <p className="text-muted-foreground mb-4">
              The record details could not be retrieved.
            </p>
            <Button onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <Breadcrumb>
          <BreadcrumbList>
            {/* <BreadcrumbItem>
              <BreadcrumbLink onClick={() => navigate('/dashboard')}>
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem> */}
            {/* <BreadcrumbSeparator /> */}
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={() => navigate(`/namespaces/${namespaceId}`)}
                className="cursor-pointer hover:underline"
              >
                {breadcrumbData?.namespace_name || 'Namespace'}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={() => navigate(`/${namespaceId}/${registryName}`)}
                className="cursor-pointer hover:underline"
              >
                {breadcrumbData?.registry_name || registryName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{recordDetails?.record_name || recordName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Record Information */}
      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{recordDetails.record_name}</CardTitle>
              <CardDescription>{recordDetails.description}</CardDescription>
            </div>
            {recordDetails.state !== 'expired' && recordDetails.state !== 'revoked' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {renderDropdownMenuItems()}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Record ID</h3>
                  <p className="text-sm font-mono break-all">{recordDetails.record_id}</p>
                </div>
                <TrimmedValueWithCopy 
                  label="Digest" 
                  value={recordDetails.digest} 
                />
                <TrimmedValueWithCopy 
                  label="Version" 
                  value={recordDetails.version} 
                />
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Version Count</h3>
                  <p className="text-sm">{recordDetails.version_count}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Created At</h3>
                  <p className="text-sm">{formatDate(recordDetails.created_at)}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Last Updated</h3>
                  <p className="text-sm">{formatDate(recordDetails.updated_at)}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Created By</h3>
                  <p className="text-sm font-mono break-all">{recordDetails.created_by}</p>
                </div>
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">Status</h3>
                  <p className={`text-sm font-medium ${getStatusColor()}`}>
                    {getStatusDisplay()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Record Details */}
        <Card>
          <CardHeader>
            <CardTitle>Record Details</CardTitle>
            <CardDescription>
              Detailed information based on the registry schema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {Object.entries(recordDetails.details).map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="font-medium text-sm text-muted-foreground mb-1 sm:mb-0">
                    {key}
                  </div>
                  <div className="text-sm font-mono break-all sm:text-right">
                    {value !== null && value !== undefined && value !== '' ? String(value) : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Schema Information */}
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore */}
        {((() => {
          if (!recordDetails?.schema) return null;
          return <SchemaInfoCard schema={recordDetails.schema} />;
        })() as JSX.Element | null)}

        {/* Metadata */}
        {recordDetails.meta && Object.keys(recordDetails.meta).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>
                Additional metadata associated with this record
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(recordDetails.meta, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Update Record Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Record</DialogTitle>
            <DialogDescription>
              Update the record details and metadata
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* <div className="space-y-2">
                  <Label htmlFor="record-name">Record Name *</Label>
                  <Input
                    id="record-name"
                    value={updateFormData.new_record_name}
                    onChange={(e) => setUpdateFormData(prev => ({ ...prev, new_record_name: e.target.value }))}
                    placeholder="Enter record name"
                  />
                </div> */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={updateFormData.description}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 200) {
                        setUpdateFormData(prev => ({ ...prev, description: value }));
                      }
                    }}
                    placeholder="Enter record description"
                    rows={3}
                    maxLength={200}
                  />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Maximum 200 characters</span>
                    <span className={`${
                      updateFormData.description.length > 180 
                        ? 'text-red-500' 
                        : updateFormData.description.length > 160 
                        ? 'text-yellow-500' 
                        : 'text-muted-foreground'
                    }`}>
                      {updateFormData.description.length}/200
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Record Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Record Details</h3>
              <div className="grid gap-4">
                {recordDetails && Object.keys(recordDetails.schema).map((field) => {
                  const fieldType = (typeof recordDetails.schema[field] === 'string' 
                    ? recordDetails.schema[field].toLowerCase() 
                    : 'string');
                  
                  return (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={`detail-${field}`}>
                        {field} ({String(recordDetails.schema[field])})
                      </Label>
                      {fieldType === 'boolean' || fieldType === 'bool' ? (
                        <Select
                          value={updateFormData.details[field] || ''}
                          onValueChange={(value: string) => handleDetailsChange(field, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${field}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`detail-${field}`}
                          type={
                            fieldType === 'integer' || fieldType === 'int' 
                              ? 'number'
                              : fieldType === 'float' || fieldType === 'double' || fieldType === 'number'
                              ? 'number'
                              : 'text'
                          }
                          step={
                            fieldType === 'float' || fieldType === 'double' || fieldType === 'number'
                              ? 'any'
                              : fieldType === 'integer' || fieldType === 'int'
                              ? '1'
                              : undefined
                          }
                          value={updateFormData.details[field] || ''}
                          onChange={(e) => handleDetailsChange(field, e.target.value)}
                          placeholder={`Enter ${field}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label>Metadata (Optional)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-xs p-2 text-sm">
                        <p className="font-bold">Customizable Metadata</p>
                        <p className="my-2">
                          These are the customizable fields where you can define your own data types as per your application needs.
                        </p>
                        <p className="font-semibold">Example:</p>
                        <div className="ml-2">
                          <p>
                            <code className="font-mono text-xs">"bg-card-image"</code>: <code className="font-mono text-xs">"ImageUrl"</code>
                          </p>
                        </div>
                        <p className="my-2 text-xs text-slate-50">
                              You can use this image URL as per your app requirement.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid gap-4">
                {Object.keys(updateFormData.meta).map((key, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const newKey = e.target.value;
                        const value = updateFormData.meta[key];
                        setUpdateFormData(prev => {
                          const newMeta = { ...prev.meta };
                          delete newMeta[key];
                          if (newKey) {
                            newMeta[newKey] = value;
                          }
                          return { ...prev, meta: newMeta };
                        });
                      }}
                      placeholder="Metadata key"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={updateFormData.meta[key] || ''}
                        onChange={(e) => handleMetaChange(key, e.target.value)}
                        placeholder="Metadata value"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setUpdateFormData(prev => {
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
                    const newKey = `key_${Date.now()}`;
                    setUpdateFormData(prev => ({
                      ...prev,
                      meta: { ...prev.meta, [newKey]: '' }
                    }));
                  }}
                >
                  Add Metadata Field
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateModalOpen(false)} disabled={updateLoading}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRecord} disabled={updateLoading}>
              {updateLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Record'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Alert Dialog */}
      <AlertDialog open={isPublishAlertOpen} onOpenChange={setIsPublishAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to publish this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will publish the record "{recordDetails.record_name}" and make it live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePublishRecord} 
              className="bg-green-600 hover:bg-green-700"
              disabled={publishLoading}
            >
              {publishLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Publishing...
                </>
              ) : (
                'Publish'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Alert Dialog */}
      <AlertDialog open={isSuspendAlertOpen} onOpenChange={setIsSuspendAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to suspend this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will suspend the record "{recordDetails.record_name}". You can reinstate it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suspendLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSuspendRecord} 
              className="bg-orange-600 hover:bg-orange-700"
              disabled={suspendLoading}
            >
              {suspendLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Suspending...
                </>
              ) : (
                'Suspend'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Alert Dialog */}
      <AlertDialog open={isRevokeAlertOpen} onOpenChange={setIsRevokeAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to revoke this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will revoke the record "{recordDetails.record_name}". This action may not be reversible and will mark the record as invalid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevokeRecord} 
              className="bg-red-600 hover:bg-red-700"
              disabled={revokeLoading}
            >
              {revokeLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Revoking...
                </>
              ) : (
                'Revoke'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reinstate Alert Dialog */}
       <AlertDialog open={isReinstateAlertOpen} onOpenChange={setIsReinstateAlertOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Are you sure you want to reinstate this record?</AlertDialogTitle>
             <AlertDialogDescription>
               This action will reinstate the record "{recordDetails.record_name}" from revoked status, making it active again.
             </AlertDialogDescription>
           </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reinstateLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReinstateRecord} 
              className="bg-green-600 hover:bg-green-700"
              disabled={reinstateLoading}
            >
              {reinstateLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Reinstating...
                </>
              ) : (
                'Reinstate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}