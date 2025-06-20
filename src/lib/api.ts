import axios from 'axios';

// Create an axios instance with default configuration
// You can replace the baseURL with your actual API URL when ready
const api = axios.create({
  baseURL: 'https://dev.dedi.global', // Replace with your API URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
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
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }),
  
  signup: (userData: {
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => api.post('/auth/signup', userData),
  
  logout: () => api.post('/auth/logout'),
  
  getCurrentUser: () => api.get('/auth/me'),
};

// Export the api instance for other requests
export default api;

// Get the API base URL from environment variable or use default
const API_BASE_URL = import.meta.env.VITE_ENDPOINT || 'https://dev.dedi.global';

export interface SignupRequest {
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  hashed_password: string;
}

export interface LoginRequest {
  email: string;
  hashed_password: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  email_verified: boolean;
  realm_roles: string[];
}

// Signup API call
export async function signupUser(userData: SignupRequest): Promise<ApiResponse<User | string>> {
  try {
    const { username, firstname, lastname, email, hashed_password } = userData;
    const response = await fetch(`${API_BASE_URL}/dedi/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        firstname,
        lastname,
        email,
        hashed_password: hashed_password,
      }),
    });

    const result = await response.json();
    
    // Check if the HTTP status indicates success (200-299)
    if (response.ok) {
      // For successful responses, ensure we have a success message
      if (!result.message) {
        result.message = "Resource created successfully";
      }
      return result;
    } else {
      // For non-success HTTP status codes, throw an error with the response message
      const errorMessage = result.message || result.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    
  } catch (error) {
    if (error instanceof Error) {
      throw error; // Re-throw existing errors
    }
    throw new Error('Network error occurred while registering');
  }
}

// Login API call (endpoint to be provided later)
export async function loginUser(credentials: LoginRequest): Promise<ApiResponse<User | string>> {
  try {
    const { email, hashed_password } = credentials;
    const response = await fetch(`${API_BASE_URL}/dedi/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, hashed_password: hashed_password }),
    });

    const result = await response.json();
    
    // Always return the result - let the calling function handle success/error
    return result;
    
  } catch (error) {
    throw new Error('Network error occurred while logging in');
  }
}