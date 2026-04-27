# Database Improvement Proposal

## 1. Background

Current application behavior for word lookup and storage is:

1. User query arrives.
2. Check `Word` for the current `userId`.
3. If found, return the private user word.
4. If not found, check `PublicWord`.
5. If public word exists, return it and copy the entry into `Word` for the user.
6. If public miss, query the LLM, then save the result to both `PublicWord` and `Word`.

This works functionally, but it creates redundant data and repeated write traffic because the private `Word` table is used as both a cache and an ownership store.

## 2. Problem statement

The main inefficiency is the current record-duplication strategy:

- `PublicWord` entries are duplicated into `Word` for every user who queries them.
- `Word` becomes a hybrid store that duplicates shared content instead of referencing it.
- Public lookups generate redundant writes that primarily exist to support future user lookups.
- This duplication wastes memory and makes the private table heavier than necessary.

The core requirement is to stop copying full public word data and instead use ID tagging to mark ownership and origin.

## 3. Goals for optimization

The upcoming optimization should aim to:

- Reduce redundant data writes and storage duplication
- Preserve a clean separation between global public vocabulary and user-owned word records
- Keep `userId` as the ownership marker for private records
- Automatically persist lookup results so future queries use local metadata and reduce LLM dependency
- Enforce that users cannot modify word content; they may only delete words from their own word bank or manage group membership

## 4. Recommended model and behavior changes

### 4.1 Keep the `Word` table as the user-owned vocabulary record store

`Word` should continue to represent a user-specific vocabulary bank, but its role should be more about ownership and reference than full content duplication.

- `userId` remains the ownership marker.
- Existing unique constraint `@@unique([word, userId])` should remain.
- User records should be created automatically after a successful lookup from either public or LLM sources.
- Users should not be able to modify word content directly; they can only delete items from their own `Word` records or add/remove group membership.
- Deletion and grouping operations must never alter `PublicWord`.

### 4.2 Use `PublicWord` as the shared definition source and link by ID

The preferred pattern is:

- Query `Word` first for the logged-in user.
- If no user record exists, query `PublicWord`.
- If `PublicWord` returns a result, return that result and create a lightweight `Word` record referencing the public entry.
- If `PublicWord` misses, query the LLM, save the new definition to `PublicWord`, and create a `Word` record that links to the new public entry.

In other words, words are saved automatically once they are resolved from public or LLM sources, but the private row should be an ID-tagged reference instead of a full duplicated copy.

### 4.3 Add reference and origin metadata to support tagging

To support this architecture, enhance `Word` with tagging fields such as:

- `sourceType`: `'USER' | 'PUBLIC' | 'LLM'`
- `publicWordId`: optional reference to `PublicWord.id`
- `createdAt` / `updatedAt` metadata for the user record

With this design, user records can remain lightweight, and the actual definitions remain centralized in `PublicWord` whenever possible.

### 4.4 Normalize words for reliable lookup and indexing

The current code uses `lower(word)` in raw SQL and sometimes mixes case-sensitive comparisons.

Recommended optimization:

- Add a normalized column like `wordNormalized` or `wordLower`
- Store `LOWER(TRIM(word))` at write time
- Index the normalized field for faster lookup across `Word` and `PublicWord`

This reduces expensive runtime transformations and improves lookup consistency.

## 5. Service-level optimization suggestions

### 5.1 Revise `CacheService.copyPublicWordsToUserDb`

That method currently upserts full public hits into personal `Word` rows. It should instead:

- create lightweight user `Word` records with `publicWordId` references
- avoid duplicating full translation/phonetic/example content into the private table
- keep group association logic separate from pure lookup persistence

This maintains automatic persistence without wasting memory on duplicate public content.

### 5.2 Rework or remove `cascadePublicWordToPrivate`

The cascade function currently updates matching private rows by normalized word.

With ID tagging, this is less necessary because shared definitions are referenced rather than duplicated.

If kept, it should only be used for explicit sync operations and never to overwrite user-owned definitions implicitly.

### 5.3 Deduplicate review-group writes

Current flow also writes `ReviewGroupWord` links in multiple places during lookup and cache updates.

Recommendation:

- deduplicate review-group membership logic
- only create group links when a word is intentionally added to that group

## 6. Expected benefits

Implementing the above changes should yield:

- lower write volume during translation/lookups
- smaller private-user storage footprint
- a clearer separation between personal ownership and shared definition data
- faster future queries through automatic local persistence
- safer handling of public library updates and user permission boundaries

## 7. Migration considerations

If the project evolves from the current behavior:

- keep the existing `Word` / `PublicWord` schema during transition
- add `publicWordId` and `sourceType` as metadata fields
- change lookup logic first, then adjust write behavior
- preserve backwards compatibility for current user data
- optionally migrate duplicated private copies into reference-based records over time

## 8. Summary

The updated optimization targets a cleaner architecture:

- `Word` = user-owned reference record
- `PublicWord` = centralized shared vocabulary definitions
- user lookup = private first, then public fallback, then LLM
- automatically persist resolved words for future local lookup
- use ID tagging instead of copying bulk data
- users can delete their own word records or manage group membership, but cannot modify shared word content

This approach retains `userId` as the ownership marker while eliminating the heavy duplication caused by full data copies.