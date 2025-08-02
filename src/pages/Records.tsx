import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, MoreVertical, Eye, Info, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RecordDetails {
  [key: string]: string | number;
}

interface RecordItem {
  digest: string;
  record_name: string;
  record_id: string;
  description: string;
  details: RecordDetails;
  created_at: string;
  updated_at: string;
  created_by: string;
  version_count: number;
  version: string;
  meta: unknown;
  is_revoked: boolean | null;
  is_archived: boolean | null;
  state: string;
}

interface RecordsApiResponse {
  message: string;
  data: {
    namespace_id: string;
    namespace_name: string;
    registry_name: string;
    registry_id: string;
    schema: { [key: string]: unknown; properties?: { [key: string]: unknown } };
    created_by: string;
    created_at: string;
    updated_at: string;
    total_records: number;
    records: RecordItem[];
  };
}

// Interface for add record form data
interface AddRecordFormData {
  record_name: string;
  description: string;
  details: { [key: string]: string };
  meta: { [key: string]: unknown };
  arrayFields: { [key: string]: unknown[] }; // Add array fields support
}

// Interface for add record API response
// interface AddRecordApiResponse {
//   message: string;
//   data: {
//     record_id: string;
//   };
// }

// Interface for search record
interface SearchRecord {
  id: string;
  registry_name: string;
  record_name: string;
  details: { [key: string]: unknown };
  created_at: string;
  updated_at: string;
  namespace_id: string;
}

// Interface for search response
interface SearchResponse {
  message: string;
  data: SearchRecord[];
}

// Interface for search field
interface SearchField {
  key: string;
  value: string;
}

// Define array field configurations based on schema
const arrayFieldConfigs: { [key: string]: { [key: string]: string } } = {
  previousKeys: {
    publicKey: 'string',
    keyType: 'string', 
    keyFormat: 'string'
  }
};

// Define required fields for each schema type
const getRequiredFields = (schemaType: string): string[] => {
  switch (schemaType) {
    case 'membership':
      return ['membership_id', 'detail_name']; // detail.name becomes detail_name in flattened form
    case 'publicKey':
      return ['public_key_id', 'publicKey', 'keyType']; // entity is not required at root level
    case 'revoke':
      return ['revoked_id'];
    default:
      return [];
  }
};

// Helper function to check if a field is required
const isFieldRequired = (fieldKey: string, schemaType: string): boolean => {
  const requiredFields = getRequiredFields(schemaType);
  return requiredFields.includes(fieldKey);
};

export function RecordsPage() {
  const { namespaceId, registryName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [schema, setSchema] = useState<{ [key: string]: unknown; properties?: { [key: string]: unknown } }>({});
  const [namespaceName, setNamespaceName] = useState<string>('Loading...');
  const [registryDisplayName, setRegistryDisplayName] = useState<string>('Loading...');
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saveAsDraftLoading, setSaveAsDraftLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [showAddMetadata, setShowAddMetadata] = useState(false);
  const [addFormData, setAddFormData] = useState<AddRecordFormData>({
    record_name: '',
    description: '',
    details: {},
    meta: {},
    arrayFields: {},
  });

  const [missingFields] = useState<string[]>([]);

  // Get schema type from registry name or schema properties
  const getSchemaType = (): string => {
    // Try to determine from registry name first
    if (registryDisplayName.toLowerCase().includes('membership')) return 'membership';
    if (registryDisplayName.toLowerCase().includes('public') || registryDisplayName.toLowerCase().includes('key')) return 'publicKey';
    if (registryDisplayName.toLowerCase().includes('revoke')) return 'revoke';
    
    // Try to determine from schema properties
    const schemaProperties = schema.properties || schema;
    const fieldNames = Object.keys(schemaProperties);
    
    if (fieldNames.includes('membership_id') || fieldNames.includes('detail')) return 'membership';
    if (fieldNames.includes('public_key_id') || fieldNames.includes('publicKey')) return 'publicKey';
    if (fieldNames.includes('revoked_id')) return 'revoke';
    
    return 'unknown';
  };

  // Search functionality state
  const [searchFields, setSearchFields] = useState<SearchField[]>([]);
  const [searchResults, setSearchResults] = useState<SearchRecord[]>([]);

  const [showSearchResults, setShowSearchResults] = useState(false);


  // Get all available search fields (record_name + schema fields)
  const getAvailableSearchFields = () => {
    const schemaProperties = schema.properties || schema;
    const schemaFields = Object.keys(schemaProperties);
    return ['record_name', ...schemaFields];
  };

  // Initialize search with one empty field
  useEffect(() => {
    if (Object.keys(schema).length > 0 && searchFields.length === 0) {
      setSearchFields([{ key: 'record_name', value: '' }]);
    }
  }, [schema, searchFields.length]);

  // Search function
  const handleSearch = async () => {
    const activeFields = searchFields.filter(field => field.key && field.value.trim());
    
    if (activeFields.length === 0) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";
      
      // Build query parameters
      const searchParams = new URLSearchParams();
      searchParams.append('registry_name', registryName || '');
      
      activeFields.forEach(field => {
        searchParams.append(field.key, field.value.trim());
      });
      
      const response = await fetch(
        `${API_BASE_URL}/dedi/search/${namespaceId}?${searchParams.toString()}`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result: SearchResponse = await response.json();

      if (result.message === "Search results") {
        setSearchResults(result.data);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error("❌ Error searching records:", error);
      toast({
        title: "Search Error",
        description: "Failed to search records. Please try again.",
        variant: "destructive",
      });
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Debounced search function - triggers search automatically after user stops typing
  const handleDebouncedSearch = useCallback(() => {
    const activeFields = searchFields.filter(field => field.key && field.value.trim());
    
    // Clear previous timeout
    const timeoutId = setTimeout(() => {
      if (activeFields.length > 0) {
        handleSearch();
      } else {
        // Clear search results if no active fields
        setShowSearchResults(false);
        setSearchResults([]);
      }
    }, 500); // 500ms debounce

    // Cleanup function to clear timeout
    return () => clearTimeout(timeoutId);
  }, [handleSearch, searchFields]);

  // Add search field
  const addSearchField = () => {
    const availableFields = getAvailableSearchFields();
    const usedFields = searchFields.map(f => f.key);
    const nextField = availableFields.find(field => !usedFields.includes(field));
    
    if (nextField) {
      setSearchFields([...searchFields, { key: nextField, value: '' }]);
    }
  };

  // Remove search field
  const removeSearchField = (index: number) => {
    if (searchFields.length > 1) {
      setSearchFields(searchFields.filter((_, i) => i !== index));
    }
  };

  // Update search field
  const updateSearchField = (index: number, key: string, value: string) => {
    const newFields = [...searchFields];
    newFields[index] = { key, value };
    setSearchFields(newFields);
  };

  // Effect to trigger debounced search when search fields change
  useEffect(() => {
    const cleanup = handleDebouncedSearch();
    return cleanup;
  }, [handleDebouncedSearch]);

  // Clear search
  const clearSearch = () => {
    setSearchFields([{ key: 'record_name', value: '' }]);
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Handle clicking on a search result
  const handleSearchResultClick = (record: SearchRecord) => {
    navigate(`/${namespaceId}/${registryName}/${record.record_name}`);
  };

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      const response = await fetch(`${API_BASE_URL}/dedi/internal/${namespaceId}/${registryName}/query-records-by-profile`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: RecordsApiResponse = await response.json();
      
      if (response.ok && result.message === "Resource retrieved successfully") {
        setRecords(result.data.records || []);
        setSchema(result.data.schema || {});
        setNamespaceName(result.data.namespace_name || 'Loading...');
        setRegistryDisplayName(result.data.registry_name || 'Loading...');
        setTotalRecords(result.data.total_records || 0);
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to fetch records',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching records:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch records. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [namespaceId, registryName, toast]);

  useEffect(() => {
    if (namespaceId && registryName) {
      fetchRecords();
    }
  }, [namespaceId, registryName, fetchRecords]);

  const handleRowClick = (record: RecordItem) => {
    navigate(`/${namespaceId}/${registryName}/${record.record_name}`);
  };

  const handleOpenAddModal = () => {
    // Initialize form with empty details based on schema
    const initialDetails: { [key: string]: string } = {};
    const initialArrayFields: { [key: string]: unknown[] } = {};
    
    // Handle both simple schema format and JSON schema format
    const schemaProperties = schema.properties || schema;
    
    Object.keys(schemaProperties).forEach(field => {
      const fieldSchema = schema.properties ? schema.properties[field] : schema[field];
      const fieldType = (fieldSchema && typeof fieldSchema === 'object' && 'type' in fieldSchema 
        ? (fieldSchema as { type: string }).type?.toLowerCase() 
        : 'string') || 'string';
      
      if (fieldType === 'array' && arrayFieldConfigs[field]) {
        // Initialize array fields with one empty item
        const emptyItem: { [key: string]: string } = {};
        Object.keys(arrayFieldConfigs[field]).forEach(itemKey => {
          emptyItem[itemKey] = '';
        });
        initialArrayFields[field] = [emptyItem];
      } else {
        initialDetails[field] = '';
      }
    });
    
    setAddFormData({
      record_name: '',
      description: '',
      details: initialDetails,
      meta: {},
      arrayFields: initialArrayFields,
    });
    setShowAddMetadata(false);
    setIsAddModalOpen(true);
  };

  // Array field management functions
  const addArrayItem = (fieldKey: string) => {
    const config = arrayFieldConfigs[fieldKey];
    if (!config) return;
    
    const emptyItem: { [key: string]: string } = {};
    Object.keys(config).forEach(itemKey => {
      emptyItem[itemKey] = '';
    });
    
    setAddFormData(prev => ({
      ...prev,
      arrayFields: {
        ...prev.arrayFields,
        [fieldKey]: [...(prev.arrayFields[fieldKey] || []), emptyItem]
      }
    }));
  };

  const removeArrayItem = (fieldKey: string, index: number) => {
    setAddFormData(prev => ({
      ...prev,
      arrayFields: {
        ...prev.arrayFields,
        [fieldKey]: prev.arrayFields[fieldKey]?.filter((_, i) => i !== index) || []
      }
    }));
  };

  const updateArrayItem = (fieldKey: string, index: number, itemKey: string, value: string) => {
    setAddFormData(prev => ({
      ...prev,
      arrayFields: {
        ...prev.arrayFields,
        [fieldKey]: prev.arrayFields[fieldKey]?.map((item: unknown, i) => 
          i === index ? { ...(item as object), [itemKey]: value } : item
        ) || []
      }
    }));
  };

  // Save record as draft
  const handleSaveAsDraft = async () => {
    if (saveAsDraftLoading || publishLoading) return; // Prevent multiple submissions
    
    try {
      setSaveAsDraftLoading(true);
      
      // Validate required fields
      if (!addFormData.record_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Record name is required',
          variant: 'destructive',
        });
        return;
      }

      if (!addFormData.description.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Description is required',
          variant: 'destructive',
        });
        return;
      }

      // Prepare details with proper type conversion
      const finalDetails: { [key: string]: string | number | boolean | unknown[] } = {};
      
      // Convert form data to proper types based on schema
      const schemaProps = schema.properties || schema;
      Object.keys(schemaProps).forEach(field => {
        const fieldSchema = schema.properties ? schema.properties[field] : schema[field];
        const fieldType = (fieldSchema && typeof fieldSchema === 'object' && 'type' in fieldSchema 
          ? (fieldSchema as { type: string }).type?.toLowerCase() 
          : 'string') || 'string';
        const value = addFormData.details[field];
        
        if (value !== undefined && value !== '') {
          switch (fieldType) {
            case 'integer':
            case 'int': {
              const intValue = parseInt(value, 10);
              if (!isNaN(intValue)) {
                finalDetails[field] = intValue;
              }
              break;
            }
            case 'number':
            case 'float':
            case 'double': {
              const floatValue = parseFloat(value);
              if (!isNaN(floatValue)) {
                finalDetails[field] = floatValue;
              }
              break;
            }
            case 'boolean':
            case 'bool':
              finalDetails[field] = value === 'true' || value === '1';
              break;
            case 'string':
            default:
              finalDetails[field] = value;
              break;
          }
        }
      });
      
      // Process array fields
      Object.keys(addFormData.arrayFields).forEach(fieldKey => {
        const arrayItems = addFormData.arrayFields[fieldKey] || [];
        const validItems = arrayItems.filter(item => 
          Object.values(item as { [key: string]: unknown }).some(val => val && String(val).trim() !== '')
        );
        if (validItems.length > 0) {
          finalDetails[fieldKey] = validItems;
        }
      });

      // Prepare metadata (optional)
      let parsedMeta = {};
      if (showAddMetadata && Object.keys(addFormData.meta).length > 0) {
        parsedMeta = addFormData.meta;
      }

      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      
      const response = await fetch(`${API_BASE_URL}/dedi/${namespaceId}/${registryName}/save-record-as-draft`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          record_name: addFormData.record_name.trim(),
          description: addFormData.description.trim(),
          details: finalDetails,
          ...(Object.keys(parsedMeta).length > 0 && { meta: parsedMeta })
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Record saved as draft successfully',
        });
        setIsAddModalOpen(false);
        setAddFormData({
          record_name: '',
          description: '',
          details: {},
          meta: {},
          arrayFields: {},
        });
        setShowAddMetadata(false);
        // Refresh the records list
        await fetchRecords();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to save record as draft',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving record as draft:', error);
      toast({
        title: 'Error',
        description: 'Failed to save record as draft. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaveAsDraftLoading(false);
    }
  };

  // Publish record directly
  const handlePublishRecord = async () => {
    if (saveAsDraftLoading || publishLoading) return; // Prevent multiple submissions
    
    try {
      setPublishLoading(true);
      
      // Validate required fields
      if (!addFormData.record_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Record name is required',
          variant: 'destructive',
        });
        return;
      }

      if (!addFormData.description.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Description is required',
          variant: 'destructive',
        });
        return;
      }

      // Prepare details with proper type conversion
      const finalDetails: { [key: string]: string | number | boolean | unknown[] } = {};
      
      // Convert form data to proper types based on schema
      const schemaProps = schema.properties || schema;
      Object.keys(schemaProps).forEach(field => {
        const fieldSchema = schema.properties ? schema.properties[field] : schema[field];
        const fieldType = (fieldSchema && typeof fieldSchema === 'object' && 'type' in fieldSchema 
          ? (fieldSchema as { type: string }).type?.toLowerCase() 
          : 'string') || 'string';
        const value = addFormData.details[field];
        
        if (value !== undefined && value !== '') {
          switch (fieldType) {
            case 'integer':
            case 'int': {
              const intValue = parseInt(value, 10);
              if (!isNaN(intValue)) {
                finalDetails[field] = intValue;
              }
              break;
            }
            case 'number':
            case 'float':
            case 'double':
              { const floatValue = parseFloat(value);
              if (!isNaN(floatValue)) {
                finalDetails[field] = floatValue;
              }
              break; }
            case 'boolean':
            case 'bool':
              finalDetails[field] = value === 'true' || value === '1';
              break;
            case 'string':
            default:
              finalDetails[field] = value;
              break;
          }
        }
      });
      
      // Process array fields
      Object.keys(addFormData.arrayFields).forEach(fieldKey => {
        const arrayItems = addFormData.arrayFields[fieldKey] || [];
        const validItems = arrayItems.filter(item => 
          Object.values(item as object).some(val => val && String(val).trim() !== '')
        );
        if (validItems.length > 0) {
          finalDetails[fieldKey] = validItems;
        }
      });

      // Prepare metadata (optional)
      let parsedMeta = {};
      if (showAddMetadata && Object.keys(addFormData.meta).length > 0) {
        parsedMeta = addFormData.meta;
      }

      const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';
      
      // Publish the record directly using save-record-as-draft with publish=true
      const publishResponse = await fetch(`${API_BASE_URL}/dedi/${namespaceId}/${registryName}/save-record-as-draft?publish=true`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          record_name: addFormData.record_name.trim(),
          description: addFormData.description.trim(),
          details: finalDetails,
          ...(Object.keys(parsedMeta).length > 0 && { meta: parsedMeta })
        }),
      });

      const publishResult = await publishResponse.json();

      if (publishResponse.ok) {
        toast({
          title: 'Success',
          description: 'Record published successfully',
        });
        setIsAddModalOpen(false);
        setAddFormData({
          record_name: '',
          description: '',
          details: {},
          meta: {},
          arrayFields: {},
        });
        setShowAddMetadata(false);
        // Refresh the records list
        await fetchRecords();
      } else {
        toast({
          title: 'Error',
          description: publishResult.message || 'Failed to publish record',
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



  const handleDetailsChange = (key: string, value: string) => {
    setAddFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        [key]: value,
      },
    }));
  };

  const handleMetaChange = (key: string, value: unknown) => {
    setAddFormData(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        [key]: value,
      },
    }));
  };

  // Get column headers from schema plus the record name column
  const getColumnHeaders = () => {
    const schemaProperties = schema.properties || schema;
    const headers = ['Record Name', ...Object.keys(schemaProperties), 'Status'];
    return headers;
  };

  // Get cell value for a record and column
  const getCellValue = (record: RecordItem, column: string) => {
    if (column === 'Record Name') {
      return record.record_name;
    }
    
    if (column === 'Status') {
      const state = record.state?.toLowerCase() || 'unknown';
      
      switch (state) {
        case 'draft':
          return (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
              Draft
            </Badge>
          );
        case 'published':
        case 'active':
        case 'live':
          return (
            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
              {record.state === 'live' ? 'Live' : 'Published'}
            </Badge>
          );
        case 'archived':
          return (
            <Badge variant="outline" className="bg-gray-100 text-gray-800 hover:bg-gray-200">
              Archived
            </Badge>
          );
        case 'revoked':
          return (
            <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
              Revoked
            </Badge>
          );
        default:
          return (
            <Badge variant="outline" className="bg-gray-100 text-gray-600 hover:bg-gray-200">
              {record.state || 'Unknown'}
            </Badge>
          );
      }
    }
    
    const value = record.details[column];
    
    // Handle array fields
    if (Array.isArray(value)) {
      return `${value.length} item(s)`;
    }
    
    // Handle object fields (for arrays stored as JSON strings)
    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return `${parsed.length} item(s)`;
        }
        return 'Object';
      } catch {
        // If parsing fails, return the string as is
        return value;
      }
    }
    
    return value || '';
  };



  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading records...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Navigation */}
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/namespaces/${namespaceId}`}>{namespaceName}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{registryDisplayName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Records</h1>
          <p className="text-muted-foreground mt-2">
            Manage records in {registryDisplayName} ({totalRecords} total records)
          </p>
        </div>
        <Button onClick={handleOpenAddModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add Record
        </Button>
      </div>

      {/* Advanced Search Bar */}
      <div className="mb-8">
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Search Records</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={addSearchField}
                disabled={searchFields.length >= getAvailableSearchFields().length}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSearch}
              >
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {searchFields.map((field, index) => (
              <div key={index} className="flex items-center gap-3">
                <Select
                  value={field.key}
                  onValueChange={(value) => updateSearchField(index, value, field.value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="record_name" value="record_name">
                      Record Name
                    </SelectItem>
                    {Object.keys(schema.properties || schema).map((schemaField) => (
                      <SelectItem key={schemaField} value={schemaField}>
                        {schemaField}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  placeholder="Enter search value"
                  value={field.value}
                  onChange={(e) => updateSearchField(index, field.key, e.target.value)}
                  className="flex-1"
                />
                
                {searchFields.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSearchField(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          
          {/* Search automatically triggers as you type - no button needed */}
        </div>
        
        {/* Search Results */}
        {showSearchResults && (
          <div className="mt-4 bg-white border rounded-lg shadow-sm">
            <div className="p-4 border-b">
              <h4 className="font-medium">Search Results</h4>
            </div>
            {searchResults.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">No records found matching your search criteria</p>
              </div>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {searchResults.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleSearchResultClick(record)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {record.record_name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated: {new Date(record.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Show matching field details */}
                    {record.details && Object.keys(record.details).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(record.details).slice(0, 3).map(([key, value]) => (
                          <span key={key} className="mr-4">
                            <strong>{key}:</strong> {String(value).substring(0, 30)}
                            {String(value).length > 30 ? '...' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-lg font-medium mb-2">No records found</div>
          <p className="text-muted-foreground">
            Get started by adding your first record
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registry Records</CardTitle>
            <CardDescription>
              Showing {records.length} of {totalRecords} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {getColumnHeaders().map((header) => (
                      <TableHead key={header} className="font-medium">
                        {header}
                      </TableHead>
                    ))}
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, index) => (
                    <TableRow 
                      key={record.record_id || record.digest || `record-${index}`} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(record)}
                    >
                      {getColumnHeaders().map((column) => (
                        <TableCell key={column}>
                          {getCellValue(record, column)}
                        </TableCell>
                      ))}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleRowClick(record)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Record Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Record</DialogTitle>
            <DialogDescription>
              Create a new record in {registryDisplayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-record-name">Record Name *</Label>
                  <Input
                    id="add-record-name"
                    value={addFormData.record_name}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow alphanumeric characters, hyphens, and underscores
                      const filteredValue = value.replace(/[^a-zA-Z0-9_-]/g, '');
                      setAddFormData(prev => ({ ...prev, record_name: filteredValue }));
                    }}
                    placeholder="Enter record name (alphanumeric, _, - only)"
                  />
                  <p className="text-xs text-muted-foreground">Only letters, numbers, underscores (_), and hyphens (-) are allowed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-description">Description *</Label>
                  <Textarea
                    id="add-description"
                    value={addFormData.description}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 200) {
                        setAddFormData(prev => ({ ...prev, description: value }));
                      }
                    }}
                    placeholder="Enter record description"
                    rows={3}
                    maxLength={200}
                  />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Maximum 200 characters</span>
                    <span className={`${
                      addFormData.description.length > 180 
                        ? 'text-red-500' 
                        : addFormData.description.length > 160 
                        ? 'text-yellow-500' 
                        : 'text-muted-foreground'
                    }`}>
                      {addFormData.description.length}/200
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Record Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Record Details</h3>
              <div className="grid gap-4">
                {Object.keys(schema.properties || schema).map((field) => {
                  // Handle both simple schema format and JSON schema format
                  const fieldSchema = schema.properties ? schema.properties[field] : schema[field];
                  const fieldType = (fieldSchema && typeof fieldSchema === 'object' && 'type' in fieldSchema 
                    ? (fieldSchema as { type: string }).type?.toLowerCase() 
                    : 'string') || 'string';
                  const isNumeric = fieldType === 'integer' || fieldType === 'int' || fieldType === 'float' || fieldType === 'double' || fieldType === 'number';
                  const isBoolean = fieldType === 'boolean' || fieldType === 'bool';
                  const isArray = fieldType === 'array' && arrayFieldConfigs[field];
                  
                  if (isArray) {
                    const config = arrayFieldConfigs[field];
                    const arrayItems = addFormData.arrayFields[field] || [];
                    
                    return (
                      <div key={field} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>
                            {field}
                            {isFieldRequired(field, getSchemaType()) && <span className="text-red-500 ml-1">*</span>}
                            <span className="text-muted-foreground ml-1">({fieldType})</span>
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addArrayItem(field)}
                            className="flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add {field.slice(0, -1)} {/* Remove 's' from plural name */}
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {arrayItems.map((item, index) => (
                            <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                              <div className="flex items-center justify-between">
                                <h5 className="font-medium text-sm">{field.slice(0, -1)} {index + 1}</h5>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeArrayItem(field, index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  ×
                                </Button>
                              </div>
                              <div className="grid gap-3">
                                {Object.keys(config).map((itemKey) => (
                                  <div key={itemKey} className="space-y-1">
                                    <Label htmlFor={`${field}-${index}-${itemKey}`} className="text-sm">
                                      {itemKey}
                                      <span className="text-muted-foreground ml-1">({config[itemKey]})</span>
                                    </Label>
                                    <Input
                                      id={`${field}-${index}-${itemKey}`}
                                      value={(item as { [key: string]: string })[itemKey] || ''}
                                      onChange={(e) => updateArrayItem(field, index, itemKey, e.target.value)}
                                      placeholder={`Enter ${itemKey}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={`add-detail-${field}`}>
                        {field}
                        {isFieldRequired(field, getSchemaType()) && <span className="text-red-500 ml-1">*</span>}
                        <span className="text-muted-foreground ml-1">({fieldType})</span>
                      </Label>
                      {isBoolean ? (
                        <Select
                          value={addFormData.details[field] || ''}
                          onValueChange={(value: string) => handleDetailsChange(field, value)}
                        >
                          <SelectTrigger className={missingFields.includes(field) ? 'border-red-500 focus:border-red-500' : ''}>
                            <SelectValue placeholder="Select true or false" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`add-detail-${field}`}
                          type={isNumeric ? 'number' : 'text'}
                          value={addFormData.details[field] || ''}
                          onChange={(e) => handleDetailsChange(field, e.target.value)}
                          placeholder={
                            isNumeric 
                              ? `Enter ${field} (${fieldType === 'integer' || fieldType === 'int' ? 'whole number' : 'number'})`
                              : `Enter ${field}`
                          }
                          step={fieldType === 'float' || fieldType === 'double' || fieldType === 'number' ? 'any' : undefined}
                          className={missingFields.includes(field) ? 'border-red-500 focus:border-red-500' : ''}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className='flex items-center gap-2'>
                  <h3 className="text-lg font-medium">Metadata (Optional)</h3>
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
                <Switch
                  checked={showAddMetadata}
                  onCheckedChange={setShowAddMetadata}
                />
              </div>
              {showAddMetadata && (
                <div className="grid gap-4">
                  {Object.keys(addFormData.meta).map((key, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const value = addFormData.meta[key];
                          setAddFormData(prev => {
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
                          value={typeof addFormData.meta[key] === 'string' ? addFormData.meta[key] : JSON.stringify(addFormData.meta[key])}
                          onChange={(e) => {
                            let value: unknown = e.target.value;
                            // Try to parse as JSON if it looks like an object
                            if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
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
                            setAddFormData(prev => {
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
                      setAddFormData(prev => ({
                        ...prev,
                        meta: { ...prev.meta, "": "" }
                      }));
                    }}
                  >
                    Add Metadata Field
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} disabled={saveAsDraftLoading || publishLoading}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleSaveAsDraft} disabled={saveAsDraftLoading || publishLoading}>
              {saveAsDraftLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save as Draft'
              )}
            </Button>
            <Button onClick={handlePublishRecord} disabled={saveAsDraftLoading || publishLoading}>
              {publishLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Publishing...
                </>
              ) : (
                'Publish Record'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 