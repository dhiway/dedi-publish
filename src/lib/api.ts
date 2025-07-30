import axios from "axios";

// Create an axios instance with default configuration
// You can replace the baseURL with your actual API URL when ready
const api = axios.create({
  baseURL: import.meta.env.VITE_ENDPOINT || "https://registry.becknone.dev.dedi.global", // Replace with your API URL
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem("authToken");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth endpoints - simplified for registration-only flow

// Export the api instance for other requests
export default api;

// Get the API base URL from environment variable or use default
const API_BASE_URL = import.meta.env.VITE_ENDPOINT || "https://dev.dedi.global";

// Configure default fetch options to include credentials
const defaultFetchOptions = {
  credentials: "include" as RequestCredentials,
  headers: {
    "Content-Type": "application/json",
  },
};

export interface ApiResponse<T> {
  message: string;
  data: T;
}

// Registration API call - accepts email and name
export async function registerUser(
  email: string,
  name: string,
  action: string
): Promise<ApiResponse<string>> {
  try {
    const response = await fetch(`${API_BASE_URL}/dedi/register`, {
      method: "POST",
      ...defaultFetchOptions,
      body: JSON.stringify({ email, name, action }),
    });

    const result = await response.json();

    // Check if the HTTP status indicates success (200-299)
    if (response.ok) {
      // For successful responses, ensure we have a success message
      if (!result.message) {
        result.message = "Registration successful";
      }
      return result;
    } else {
      // For non-success HTTP status codes, throw an error with the response message
      const errorMessage =
        result.message ||
        result.error ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error; // Re-throw existing errors
    }
    throw new Error("Network error occurred while registering");
  }
}



// Get namespaces by profile (using cookie authentication)
export async function getNamespacesByProfile(): Promise<unknown> {
  const response = await fetch(
    `${API_BASE_URL}/dedi/get-namespace-by-profile`,
    {
      method: "GET",
      ...defaultFetchOptions,
    }
  );

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch namespaces");
  }
}

// Get namespace versions (using cookie authentication)
export async function getNamespaceVersions(namespace: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/versions/${namespace}`, {
    method: "GET",
    ...defaultFetchOptions,
  });

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch namespace versions");
  }
}

// Create namespace (using cookie authentication)
export async function createNamespace(namespaceData: {
  name: string;
  description: string;
  meta: unknown;
}): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/create-namespace`, {
    method: "POST",
    ...defaultFetchOptions,
    body: JSON.stringify(namespaceData),
  });

  const result = await response.json();

  if (response.ok) {
    return result;
  } else {
    const errorMessage =
      result.message || result.error || "Failed to create namespace";
    throw new Error(errorMessage);
  }
}

// Update namespace (using cookie authentication)
export async function updateNamespace(
  namespaceId: string,
  namespaceData: {
    name: string;
    description: string;
    meta: unknown;
  }
): Promise<unknown> {
  const response = await fetch(
    `${API_BASE_URL}/dedi/${namespaceId}/update-namespace`,
    {
      method: "POST",
      ...defaultFetchOptions,
      body: JSON.stringify(namespaceData),
    }
  );

  const result = await response.json();

  if (response.ok) {
    return result;
  } else {
    const errorMessage =
      result.message || result.error || "Failed to update namespace";
    throw new Error(errorMessage);
  }
}

// Check authentication status by calling the auth/me endpoint
// The httpOnly cookie will be automatically sent with this request
export async function checkAuthStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/dedi/auth/me`, {
      method: "GET",
      ...defaultFetchOptions,
    });

    // If the request succeeds, user is authenticated
    return response.ok;
  } catch {
    // If request fails, user is not authenticated
    return false;
  }
}

// Get current user info using the auth/me endpoint
export async function getCurrentUser(): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/auth/me`, {
    method: "GET",
    ...defaultFetchOptions,
  });

  if (response.ok) {
    return await response.json();
  } else {
    throw new Error("Not authenticated");
  }
}

// Logout function to clear authentication
export async function logoutUser(): Promise<void> {
  try {
    console.log("Logging out");
    console.log(`${API_BASE_URL}/dedi/logout`);
    console.log(defaultFetchOptions);
    const response = await fetch(`${API_BASE_URL}/dedi/logout`, {
      method: "POST",
      ...defaultFetchOptions,
    });
    if (response.ok) {
      return response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to logout");
    }
  } catch (error) {
    // Even if logout fails on server, we'll clear client state
    console.error("Logout error:", error);
    throw error;
  }
}

// Registry lookup (using cookie authentication)
export async function getRegistryLookup(namespace: string, registryName: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/lookup/${namespace}/${registryName}`, {
    method: "GET",
    ...defaultFetchOptions,
  });

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch registry details");
  }
}

// Get registry versions (using cookie authentication)
export async function getRegistryVersions(namespace: string, registryName: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/versions/${namespace}/${registryName}`, {
    method: "GET",
    ...defaultFetchOptions,
  });

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch registry versions");
  }
}

// Get registries by profile (using cookie authentication)
export async function getRegistriesByProfile(namespace: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/${namespace}/get-registry-by-profile`, {
    method: "GET",
    ...defaultFetchOptions,
  });

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch registries by profile");
  }
}

// Get record versions (using cookie authentication)
export async function getRecordVersions(namespace: string, registryName: string, recordName: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/versions/${namespace}/${registryName}/${recordName}`, {
    method: "GET",
    ...defaultFetchOptions,
  });

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch record versions");
  }
}

// Search records (using cookie authentication)
export async function searchRecords(namespace: string, query: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/dedi/search/${namespace}?q=${encodeURIComponent(query)}`, {
    method: "GET",
    ...defaultFetchOptions,
  });

  if (response.ok) {
    return await response.json();
  } else {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to search records");
  }
}
