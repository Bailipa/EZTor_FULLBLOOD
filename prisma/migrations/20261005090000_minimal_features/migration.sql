BEGIN;
ALTER TABLE "UserPreference" ADD COLUMN "minimalFeatures" JSONB;
ALTER TABLE "UserPreference" DROP CONSTRAINT "UserPreference_interfaceStyle_check";
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_interfaceStyle_check"
CHECK ("interfaceStyle" IN ('reading', 'studio', 'vivid', 'minimal'));
COMMIT;
