package com.eztor.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.content.res.XmlResourceParser;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import org.xmlpull.v1.XmlPullParser;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.HashMap;
import java.util.Map;

/**
 * 极简 FileProvider（纯 framework 实现，不依赖 androidx）。
 * 仅支持 <cache-path>：把 cacheDir/eztor-share/ 下的图片以 content:// 暴露给系统分享面板。
 * 使用方式与 android.support.v4.content.FileProvider 一致。
 */
public class ShareFileProvider extends ContentProvider {

    private static final String TAG = "ShareFileProvider";
    private static final String META_DATA = "android.support.FILE_PROVIDER_PATHS";

    private final Map<String, File> roots = new HashMap<>();

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public void attachInfo(Context context, ProviderInfo info) {
        super.attachInfo(context, info);
        // 解析 @xml/file_paths 里的 cache-path 条目
        try {
            XmlResourceParser parser = context.getResources().getXml(info.metaData.getInt(META_DATA));
            int type;
            while ((type = parser.next()) != XmlPullParser.END_DOCUMENT) {
                if (type != XmlPullParser.START_TAG) continue;
                String name = parser.getName();
                if ("cache-path".equals(name)) {
                    String path = parser.getAttributeValue(null, "path");
                    if (path == null) path = "";
                    File root = new File(context.getCacheDir(), path);
                    if (!root.exists()) root.mkdirs();
                    roots.put(path, root);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "parse file_paths failed: " + e);
        }
    }

    private File resolve(Uri uri) {
        String[] parts = uri.getPath().split("/", 2);
        File root = parts.length > 0 ? roots.get(parts[0]) : null;
        if (root == null) return null;
        File file = new File(root, parts.length > 1 ? parts[1] : "");
        // 只允许分享 cacheDir 下的文件，防路径穿越
        try {
            if (!file.getCanonicalPath().startsWith(root.getCanonicalPath())) return null;
        } catch (Exception e) {
            return null;
        }
        return file;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolve(uri);
        if (file == null) throw new FileNotFoundException("not found: " + uri);
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        File file = resolve(uri);
        if (file == null) return null;
        String n = file.getName().toLowerCase();
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
