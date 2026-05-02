export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total?: number
  page?: number
  limit?: number
}

export interface WordResult {
  word: string
  phonetic?: string
  pos?: string
  translation?: string
  example?: string
  exampleTranslation?: string
  correctCount?: number
  incorrectCount?: number
  updatedAt?: string
  isPublic?: boolean
  isNotFound?: boolean
}

export interface ReviewGroup {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  wordCount?: number
}

export function isApiResponse<T>(response: unknown): response is ApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    typeof (response as ApiResponse).success === 'boolean'
  )
}

export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message }
}

export function createErrorResponse(error: string): ApiResponse<never> {
  return { success: false, error }
}
