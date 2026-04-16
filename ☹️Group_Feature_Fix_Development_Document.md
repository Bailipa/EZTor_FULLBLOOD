# Group Feature Fix Development Document

## 1. Problem Overview

In the deployment environment (https://dogeggcode.cyou), the group feature is not working properly, throwing an "invalid origin" error.

## 2. Root Cause

### 2.1 Inconsistent CSRF Check Logic
- `/api/review-groups/[id]/words/route.ts` uses a custom `checkCSRF` function
- This function only allows origins from local development environment and `process.env.NEXT_PUBLIC_APP_URL`
- The deployment environment domain `https://dogeggcode.cyou` is not in the allowed list

### 2.2 Inconsistent CSRF Check with Other APIs
- Other APIs (such as `/api/sync`) use the `checkCsrfHeader` function from `/src/lib/csrf.ts`
- `checkCsrfHeader` dynamically generates the allowed origin list based on the request's `host` header

## 3. Solution

### 3.1 Recommended Solution: Unify CSRF Check Logic
- Replace the custom `checkCSRF` function in `/api/review-groups/[id]/words/route.ts` with `checkCsrfHeader`
- This will ensure consistency with other APIs and automatically adapt to different deployment environments

### 3.2 Alternative Solutions
1. **Modify checkCSRF function**: Add the deployment environment domain to the `allowedOrigins` array in the `checkCSRF` function
2. **Configure environment variables**: Ensure the `NEXT_PUBLIC_APP_URL` environment variable is correctly set to `https://dogeggcode.cyou`

## 4. Implementation Steps

### 4.1 Step 1: Modify API File

**File**: `/src/app/api/review-groups/[id]/words/route.ts`

**Before modification**:
```typescript
function checkCSRF(req: Request): boolean {
  const origin = req.headers.get('origin') || req.headers.get('referer');
  if (!origin) return true; // Allow requests without origin (e.g., from the same origin)
  
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);
  
  return allowedOrigins.some(allowed => origin.startsWith(allowed || ''));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!checkCSRF(req)) {
      return NextResponse.json({ success: false, error: 'Invalid origin' }, { status: 403 });
    }
    // ... other code
  }
}
```

**After modification**:
```typescript
import { checkCsrfHeader } from '@/lib/csrf';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = checkCsrfHeader(req);
    if (!csrf.valid) {
      return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 });
    }
    // ... other code
  }
}
```

### 4.2 Step 2: Update Other HTTP Methods

Similarly modify the CSRF check in `DELETE` and `GET` methods:

**Before modification**:
```typescript
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!checkCSRF(req)) {
      return NextResponse.json({ success: false, error: 'Invalid origin' }, { status: 403 });
    }
    // ... other code
  }
}
```

**After modification**:
```typescript
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = checkCsrfHeader(req);
    if (!csrf.valid) {
      return NextResponse.json({ success: false, error: csrf.reason || 'Invalid origin' }, { status: 403 });
    }
    // ... other code
  }
}
```

### 4.3 Step 3: Environment Configuration

Ensure the correct environment variables are set in the production environment:

```bash
# .env.production file
NEXT_PUBLIC_APP_URL=https://dogeggcode.cyou
```

## 5. Code Review Points

### 5.1 Security
- Ensure the CSRF check logic is correctly implemented
- Verify that the `checkCsrfHeader` function can correctly handle origins from different environments
- Ensure all HTTP methods have appropriate CSRF protection

### 5.2 Consistency
- Check if other API routes also use the `checkCsrfHeader` function
- Ensure error response formats are consistent with other APIs

### 5.3 Error Handling
- Ensure clear error messages are returned when CSRF check fails
- Check if there is appropriate logging

## 6. Test Plan

### 6.1 Local Testing
1. Start the development server
2. Log in to the system
3. Test group functionality:
   - Create a new group
   - Add words to the group
   - Remove words from the group
   - Clear the group

### 6.2 Deployment Environment Testing
1. Deploy the fixed code to the production environment
2. Log in to https://dogeggcode.cyou
3. Test the complete group feature flow:
   - Go to the "Vocabulary Book" page
   - Click "Manage Groups"
   - Select words from the vocabulary book
   - Click "Add to Group"
   - Create a new group or select an existing group, click the "Confirm Add" button
   - Verify words are successfully added to the group
   - Verify the group's word count is updated

### 6.3 Edge Case Testing
1. Test compatibility with different browsers
2. Test performance in different network environments
3. Test the case where the `NEXT_PUBLIC_APP_URL` environment variable is not set

## 7. Risk Assessment

### 7.1 Potential Risks
- **Deployment Risk**: If the `checkCsrfHeader` function behaves abnormally in the deployment environment, it may cause all API requests to fail
- **Compatibility Risk**: Modifying the CSRF check logic may affect other functions that depend on this API
- **Security Risk**: If the CSRF check is too loose, it may introduce security vulnerabilities

### 7.2 Mitigation Measures
- Conduct thorough testing before modification
- Ensure the `checkCsrfHeader` function is correctly implemented
- Monitor system performance after deployment

## 8. Expected Results

### 8.1 Functionality Restoration
- The group feature works normally in the deployment environment
- Users can successfully add words to specified groups
- The group's word count is correctly updated

### 8.2 Architecture Improvement
- Unified CSRF check logic
- Improved system maintainability
- Reduced deployment configuration complexity

## 9. Documentation Updates

### 9.1 Technical Documentation
- Update API documentation to explain the unified CSRF check mechanism
- Update deployment documentation to explain environment variable configuration requirements

### 9.2 User Documentation
- Update user manual to explain how to use the group feature
- Add FAQ to explain possible error situations

## 10. Conclusion

By unifying the CSRF check logic, we can solve the group feature failure issue in the deployment environment while improving the overall architectural consistency and maintainability of the project. It is recommended to adopt the recommended solution, which can fundamentally solve the problem and avoid similar issues in the future.