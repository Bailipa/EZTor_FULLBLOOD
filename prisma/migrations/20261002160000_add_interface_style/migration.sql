ALTER TABLE "UserPreference"
ADD COLUMN "interfaceStyle" TEXT NOT NULL DEFAULT 'reading';

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_interfaceStyle_check"
CHECK ("interfaceStyle" IN ('reading', 'studio', 'vivid'));
