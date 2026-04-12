# Share Feature Technical Development Documentation

## 1. Overview and Purpose

The Share Feature in EZTor is designed to allow users to generate and download a visual poster of their vocabulary learning statistics. This feature enables users to share their learning achievements on social media or other platforms, thereby increasing user engagement and promoting the application.

### Key functionalities:
- Fetch user learning statistics from the server
- Generate a customizable shareable poster with learning stats
- Allow users to customize the quote on the poster
- Download the generated poster as a PNG image

## 2. Technical Architecture

### Component Structure

```
├── src/
│   ├── components/
│   │   ├── share/
│   │   │   ├── SharePoster.tsx   # Main share poster component
│   │   │   └── index.ts          # Export file
│   ├── app/
│   │   ├── api/
│   │   │   ├── share-stats/      # API route for fetching share stats
│   │   │   │   └── route.ts
│   │   │   └── share/            # API route for share functionality
│   │   │       └── route.ts
│   │   ├── layout.tsx             # Root layout
│   │   ├── globals.css            # Global styles
```

### Dependencies

| Dependency | Purpose |
|------------|---------|
| React | Core UI library |
| html-to-image | Convert HTML to PNG for poster generation |
| lucide-react | Icon library for UI elements |
| @wrksz/themes/client | Theme management |
| shadcn/ui | UI components (Button, Dialog, Input) |
| Tailwind CSS | Utility-first CSS framework |

### Data Flow

1. User opens the share dialog
2. Component fetches learning statistics from `/api/share-stats`
3. User can customize the quote or use a random one
4. Component generates a poster using `html-to-image`
5. User downloads the poster as a PNG file

## 3. Implementation Details

### SharePoster Component

The `SharePoster` component is the core implementation of the share feature. It handles state management, API calls, poster generation, and user interactions.

#### Key State Variables

```typescript
const [stats, setStats] = useState<ShareStats | null>(null);
const [loading, setLoading] = useState(false);
const [customQuote, setCustomQuote] = useState('');
const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [mounted, setMounted] = useState(false);
```

#### API Integration

```typescript
const fetchStats = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch('/api/share-stats');
    const data = await res.json();
    if (data.success) {
      setStats(data.data);
      setSelectedQuoteIndex(Math.floor(Math.random() * data.data.quotes.length));
    }
  } catch (e) {
    console.error('Failed to fetch stats:', e);
  } finally {
    setLoading(false);
  }
}, []);
```

#### Poster Generation

```typescript
const generatePoster = useCallback(async () => {
  if (!cardRef.current || !stats) return;

  try {
    const dataUrl = await toPng(cardRef.current, {
      quality: 1.0,
      pixelRatio: 2,
      backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
    });
    setPreviewUrl(dataUrl);
  } catch (e) {
    console.error('Failed to generate poster:', e);
  }
}, [stats, isDark]);
```

#### Card Structure

The share poster card is structured with the following elements:

```typescript
<div 
  ref={cardRef}
  className="p-8 rounded-2xl"
  style={{ 
    width: 360, 
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
  }}
>
  {/* Header section */}
  <div className="text-center mb-8">
    <div className="text-xs tracking-widest mb-2">
      EZTor
    </div>
    <div className="text-2xl font-semibold">
      学习成果
    </div>
  </div>

  {/* Username section */}
  <div className="text-center mb-8">
    <div className="text-sm">
      @{stats.username}
    </div>
  </div>

  {/* Stats grid - first row */}
  <div className="grid grid-cols-2 gap-4 mb-8">
    {/* Total words */}
    <div className="text-center p-4 rounded-xl">
      <div className="text-3xl font-bold">
        {stats.totalWords}
      </div>
      <div className="text-xs mt-1">
        已学单词
      </div>
    </div>
    {/* Study days */}
    <div className="text-center p-4 rounded-xl">
      <div className="text-3xl font-bold">
        {stats.studyDays}
      </div>
      <div className="text-xs mt-1">
        学习天数
      </div>
    </div>
  </div>

  {/* Stats grid - second row */}
  <div className="grid grid-cols-2 gap-4 mb-8">
    {/* Accuracy */}
    <div className="text-center p-4 rounded-xl">
      <div className="text-3xl font-bold">
        {stats.accuracy}%
      </div>
      <div className="text-xs mt-1">
        默写正确率
      </div>
    </div>
    {/* Today's words */}
    <div className="text-center p-4 rounded-xl">
      <div className="text-3xl font-bold">
        {stats.todayWords}
      </div>
      <div className="text-xs mt-1">
        今日学习
      </div>
    </div>
  </div>

  {/* Quote section */}
  <div className="text-center mb-6">
    <div className="text-sm italic">
      "{getCurrentQuote()}"
    </div>
  </div>

  {/* Footer section */}
  <div className="text-center">
    <div className="text-xs">
      {stats.baseUrl}
    </div>
    <div className="text-xs mt-1">
      {new Date().toLocaleDateString('zh-CN')}
    </div>
  </div>
</div>
```

### Styling

The application uses Tailwind CSS for styling, with custom theme variables defined in `globals.css`. The share poster component uses both Tailwind classes and inline styles for dynamic theming based on the user's selected theme (light/dark).

### Theme Integration

```typescript
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';
```

The component dynamically adjusts colors based on the current theme:

```typescript
style={{ 
  backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
  // Other theme-based styles
}}
```

## 4. Integration Points

### API Routes

#### Share Stats API
- **Endpoint**: `/api/share-stats`
- **Method**: GET
- **Purpose**: Fetch user learning statistics for the share poster
- **Response format**:
  ```json
  {
    "success": true,
    "data": {
      "username": "user123",
      "totalWords": 1200,
      "todayWords": 50,
      "accuracy": 95,
      "studyDays": 30,
      "baseUrl": "eztor.app",
      "quotes": ["Quote 1", "Quote 2", "Quote 3"]
    }
  }
  ```

#### Share API
- **Endpoint**: `/api/share`
- **Purpose**: Handle share-related functionality

### Component Integration

The `SharePoster` component is integrated into the application as a dialog that can be opened from various parts of the app. It uses the `Dialog` component from shadcn/ui for the modal interface.

## 5. Configuration Instructions

### Dependencies Installation

Ensure the following dependencies are installed:

```bash
# Core dependencies
npm install react

# Additional dependencies
npm install html-to-image lucide-react @wrksz/themes/client

# UI components
npm install @radix-ui/react-dialog @radix-ui/react-slot class-variance-authority

# Tailwind CSS
npm install tailwindcss postcss autoprefixer
```

### API Configuration

Ensure the API routes for share functionality are properly set up:
- `/api/share-stats/route.ts` - For fetching user statistics
- `/api/share/route.ts` - For share-related operations

## 6. Testing Guidelines

### Manual Testing

1. **Open Share Dialog**:
   - Navigate to the page where the share feature is accessible
   - Click the share button to open the dialog

2. **Test Statistics Fetching**:
   - Verify that the loading state is displayed while fetching data
   - Confirm that user statistics are correctly displayed once loaded

3. **Test Quote Customization**:
   - Click the "换一句" (Change Quote) button to test random quote selection
   - Enter a custom quote in the input field and verify it appears on the poster

4. **Test Poster Generation**:
   - Verify that the poster is generated correctly with all statistics and the selected quote
   - Check that the poster appearance changes according to the selected theme (light/dark)

5. **Test Download Functionality**:
   - Click the "保存图片" (Save Image) button
   - Verify that the poster is downloaded as a PNG file
   - Open the downloaded file to confirm it matches the preview

### Cross-Device Testing

- **Desktop**:
  - Verify the share dialog and poster display correctly
  - Test with different screen sizes

- **Mobile**:
  - Check that the share dialog fits within the screen width
  - Verify the poster is generated correctly and downloadable

## 7. Troubleshooting

### Common Issues

#### 1. Mobile Display Issue

**Problem**: Share poster dialog exceeds screen width on mobile devices.

**Possible Causes**:
- **Fixed Width**: The share card has a hardcoded width of 360px (SharePoster.tsx:146)
- **Missing Viewport Meta Tag**: No viewport meta tag in layout.tsx
- **Responsive Design**: Lack of responsive adjustments for mobile devices

**Workaround**:
- Use relative units (e.g., percentage, vw) instead of fixed width
- Add viewport meta tag to layout.tsx
- Implement media queries for mobile device adjustments

#### 2. Poster Generation Failure

**Problem**: Poster fails to generate or download.

**Possible Causes**:
- `html-to-image` library not properly installed
- Card reference (`cardRef`) not properly initialized
- Browser permissions or CORS issues

**Workaround**:
- Verify `html-to-image` is installed correctly
- Check that `cardRef` is properly attached to the card element
- Ensure the component is mounted before generating the poster

#### 3. API Fetch Errors

**Problem**: Failed to fetch user statistics.

**Possible Causes**:
- API endpoint not accessible
- Server-side errors in `/api/share-stats`
- Network connectivity issues

**Workaround**:
- Check API endpoint configuration
- Verify server-side implementation
- Add error handling for network failures

### Debugging Tips

- **Console Logs**: Use `console.log` to debug state changes and API responses
- **Network Inspection**: Check network requests in browser dev tools
- **Component State**: Use React DevTools to inspect component state
- **Error Boundaries**: Implement error boundaries to catch and display errors gracefully

## Conclusion

The Share Feature in EZTor provides users with a way to visually share their learning achievements. While the current implementation works, it has some limitations in mobile responsiveness that should be addressed. By following the guidelines in this documentation, development team members can understand the technical implementation and make necessary improvements to enhance the user experience across all devices.