import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    const buildTime = process.env.BUILD_TIME || new Date().toISOString();
    const version = packageJson.version || '0.1.0';
    
    return NextResponse.json({
      version,
      buildTime,
      name: packageJson.name || 'EZTor',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch {
    return NextResponse.json({
      version: '0.1.0',
      buildTime: new Date().toISOString(),
      name: 'EZTor',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  }
}
