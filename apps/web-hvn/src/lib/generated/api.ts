// Generated from apps/api/openapi.json. Do not edit.
export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The API process is running */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Health"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Required dependencies are available */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Readiness"];
                    };
                };
                /** @description PostgreSQL is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Readiness"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/chapters/tmp/{file}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    file: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Public temporary chapter page preview */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "image/webp": string;
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/covers/tmp/{file}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    file: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Private staged cover preview */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "image/webp": string;
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    action?: string;
                    actorUserId?: string;
                    cursor?: components["schemas"]["Id"];
                    from?: components["schemas"]["Timestamp"];
                    limit?: number;
                    targetId?: string;
                    targetKind?: "user" | "manga" | "volume" | "chapter" | "comment" | "group" | "person" | "tag" | "image_server2" | "system_notice" | "avatar_frame" | "avatar_frame_topic" | "shop_chest";
                    to?: components["schemas"]["Timestamp"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Read-only moderation audit timeline */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminAuditEntry"][];
                            meta: {
                                limit: number;
                                nextCursor: components["schemas"]["Id"] & (string | null);
                            };
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/avatar-frame-topics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Frame topics */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: (components["schemas"]["AvatarFrameTopic"] & {
                                frameCount: number;
                            })[];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                    };
                };
            };
            responses: {
                /** @description Frame topic */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AvatarFrameTopic"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/avatar-frame-topics/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Topic deleted; frames kept uncategorized */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            deleted: true;
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        name: string;
                    };
                };
            };
            responses: {
                /** @description Frame topic */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AvatarFrameTopic"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/admin/avatar-frames": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    active?: "true" | "false";
                    limit?: number;
                    limited?: "true" | "false";
                    page?: number;
                    q?: string;
                    rarity?: "R" | "SR" | "SSR";
                    topicId?: components["schemas"]["Id"] | "none";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Frame catalog */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminAvatarFrame"][];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        code: components["schemas"]["Slug"];
                        /** @default  */
                        description?: string;
                        displayScale?: number;
                        /** @default false */
                        limited?: boolean;
                        name: string;
                        offsetX?: number;
                        offsetY?: number;
                        /** @enum {string} */
                        rarity: "R" | "SR" | "SSR";
                        /** @default null */
                        topicId?: components["schemas"]["Id"] | null;
                    };
                };
            };
            responses: {
                /** @description Frame catalog entry */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminAvatarFrame"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/avatar-frames/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        active?: boolean;
                        description?: string;
                        displayScale?: number;
                        expectedVersion: number;
                        limited?: boolean;
                        name?: string;
                        offsetX?: number;
                        offsetY?: number;
                        /** @enum {string} */
                        rarity?: "R" | "SR" | "SSR";
                        topicId?: components["schemas"]["Id"] | null;
                    };
                };
            };
            responses: {
                /** @description Frame catalog entry */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminAvatarFrame"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/admin/avatar-frames/{id}/asset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        expectedVersion: number;
                        /** Format: binary */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description Frame catalog entry */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminAvatarFrame"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/avatar-frames/{id}/shop": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedShopVersion: number;
                        expectedVersion: number;
                        price?: string;
                        stock?: number;
                    };
                };
            };
            responses: {
                /** @description Frame catalog entry */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminAvatarFrame"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/admin/chapters/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Chapter management detail and editable group context */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementDetail"];
                            groupId: components["schemas"]["Id"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Chapter soft-deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/chapters/{id}/groups/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Removed a group from chapter management */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementDetail"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/chapters/{id}/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {boolean} */
                        hidden: true;
                        reason: string;
                    } | {
                        expectedVersion: number;
                        /** @enum {boolean} */
                        hidden: false;
                    };
                };
            };
            responses: {
                /** @description Updated moderation visibility */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: components["schemas"]["Id"];
                                moderationHiddenAt: components["schemas"]["Timestamp"] & (string | null);
                                /** @enum {string} */
                                publicationState: "draft" | "published" | "hidden";
                                version: number;
                            };
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    chapterId?: components["schemas"]["Id"];
                    limit?: number;
                    mangaId?: components["schemas"]["Id"];
                    page?: number;
                    q?: string;
                    status?: "visible" | "hidden";
                    userId?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Comments available to moderation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminComment"][];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/comments/{id}/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        hidden: boolean;
                    };
                };
            };
            responses: {
                /** @description Updated comment moderation visibility */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminComment"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/comments/forbidden-words": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Listed forbidden comment words */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ForbiddenWord"][];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        words: string[];
                    };
                };
            };
            responses: {
                /** @description Created forbidden comment words */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ForbiddenWord"][];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/comments/forbidden-words/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted a forbidden comment word */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ForbiddenWord"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/comments/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        hidden: boolean;
                        items: {
                            expectedVersion: number;
                            id: components["schemas"]["Id"];
                        }[];
                    };
                };
            };
            responses: {
                /** @description Updated comment moderation visibility in one transaction */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminComment"][];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    q?: string;
                    status?: "pending" | "approved" | "rejected";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminGroupManagement"][];
                            meta: {
                                hasMore: boolean;
                                limit: number;
                                page: number;
                            };
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["GroupInput"] & {
                        leaderUserId: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/groups/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/groups/{groupId}/activity": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        inactive: boolean;
                    };
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/groups/{groupId}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        action: "approve" | "reject";
                    };
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/image-server2/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ImageServer2BatchInput"];
                };
            };
            responses: {
                /** @description At most 100 eligible chapters processed; repeat if hasMore */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImageServer2BatchResult"];
                    };
                };
                /** @description Request rejected */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/image-server2/mangas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    q?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Readable manga and current-generation chapter progress */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImageServer2MangaList"];
                    };
                };
                /** @description Request rejected */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/image-server2/mangas/{id}/chapters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    state?: "missing" | "stale" | "pending" | "running" | "retry_wait" | "ready" | "failed";
                };
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Readable chapters and replica progress */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImageServer2ChapterList"];
                    };
                };
                /** @description Request rejected */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/image-server2/worker": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Persisted switch and effective environment flags; not process liveness */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImageServer2Worker"];
                    };
                };
                /** @description Request rejected */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        enabled: boolean;
                    };
                };
            };
            responses: {
                /** @description Switch saved */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ImageServer2Worker"];
                    };
                };
                /** @description Request rejected */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request rejected */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/manga": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    groupId?: components["schemas"]["Id"];
                    limit?: number;
                    moderation?: "hidden" | "visible";
                    page?: number;
                    publicationState?: "draft" | "published" | "hidden";
                    q?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Manga available to moderation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: components["schemas"]["Id"];
                                moderationHiddenAt: components["schemas"]["Timestamp"] & (string | null);
                                moderationReason: string | null;
                                /** @enum {string} */
                                publicationState: "draft" | "published" | "hidden";
                                slug: string;
                                title: string;
                                updatedAt: components["schemas"]["Timestamp"];
                                version: number;
                            }[];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/manga/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Manga management detail */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["MangaUpdateInput"];
                };
            };
            responses: {
                /** @description Updated manga metadata */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Manga soft-deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/manga/{id}/groups/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Removed a group from manga management */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/manga/{id}/owner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @default false */
                        addTargetGroupToChapters?: boolean;
                        expectedVersion: number;
                        ownerGroupId: components["schemas"]["Id"];
                        /** @default false */
                        transferSystemChapterOwnership?: boolean;
                    };
                };
            };
            responses: {
                /** @description Transferred manga ownership */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/manga/{id}/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {boolean} */
                        hidden: true;
                        reason: string;
                    } | {
                        expectedVersion: number;
                        /** @enum {boolean} */
                        hidden: false;
                    };
                };
            };
            responses: {
                /** @description Updated moderation visibility */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: components["schemas"]["Id"];
                                moderationHiddenAt: components["schemas"]["Timestamp"] & (string | null);
                                /** @enum {string} */
                                publicationState: "draft" | "published" | "hidden";
                                version: number;
                            };
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/manga/{mangaId}/chapters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    direction?: components["schemas"]["SortDirection"];
                    limit?: number;
                    moderation?: "hidden" | "visible";
                    page?: number;
                    publicationState?: "draft" | "published" | "hidden";
                    sort?: "volume" | "chapter" | "updatedAt";
                };
                header?: never;
                path: {
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Chapters available to moderation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                availablePageCount: number;
                                failureReason: string | null;
                                id: components["schemas"]["Id"];
                                isFull: boolean;
                                mangaId: components["schemas"]["Id"];
                                moderationHiddenAt: components["schemas"]["Timestamp"] & (string | null);
                                moderationReason: string | null;
                                number: string | null;
                                pageCount: number;
                                pagesVersion: number;
                                /** @enum {string} */
                                processingState: "idle" | "queued" | "processing" | "failed";
                                /** @enum {string} */
                                publicationState: "draft" | "published" | "hidden";
                                stagedPageCount: number;
                                title: string | null;
                                updatedAt: components["schemas"]["Timestamp"];
                                version: number;
                                volume: string | null;
                            }[];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/shop/chests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Administrator catalog, including retired chests */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShopChestCatalog"];
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/shop/chests/{chestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chestId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateShopChestInput"];
                };
            };
            responses: {
                /** @description Gacha response */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ShopChest"];
                        };
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Chest revision conflict or incomplete R/SR/SSR pool */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds 16 KiB */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/admin/system-notices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    q?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description System notices available to moderation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["SystemNotice"][];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description System notice was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        content: string;
                        title: string;
                    };
                };
            };
            responses: {
                /** @description Created a system notice */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["SystemNotice"];
                        };
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description System notice was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/system-notices/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        content: string;
                        title: string;
                    };
                };
            };
            responses: {
                /** @description Updated a system notice */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["SystemNotice"];
                        };
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description System notice was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted a system notice */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: components["schemas"]["Id"];
                            };
                        };
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description System notice was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    group?: "content" | "format" | "genre" | "theme";
                    q?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Tags available to moderation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminTag"][];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        group: "content" | "format" | "genre" | "theme";
                        name: string;
                        slug?: components["schemas"]["Slug"];
                    };
                };
            };
            responses: {
                /** @description Created a tag */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminTag"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {string} */
                        group: "content" | "format" | "genre" | "theme";
                        name: string;
                        slug: components["schemas"]["Slug"];
                    };
                };
            };
            responses: {
                /** @description Updated a tag */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminTag"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/tags/{id}/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        hidden: boolean;
                    };
                };
            };
            responses: {
                /** @description Updated tag visibility */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminTag"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    q?: string;
                    status?: "active" | "suspended" | "banned";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Users available to moderation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminUserSummary"][];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description User moderation detail */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminUserDetail"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{id}/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Active sessions for a moderated user */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminUserSession"][];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {string} */
                        status: "active" | "suspended" | "banned";
                    };
                };
            };
            responses: {
                /** @description Updated account status */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["AdminUserDetail"];
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Administrator access is required */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content was not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}/avatar-frames": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                };
                header?: never;
                path: {
                    userId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Owned frames, including disabled frames */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AvatarFrameInventory"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/users/{userId}/avatar-frames/{frameId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    frameId: components["schemas"]["Id"];
                    userId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @default Admin avatar frame ownership change */
                        reason?: string;
                    };
                };
            };
            responses: {
                /** @description Ownership granted; retry is a no-op */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            changed: boolean;
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    frameId: components["schemas"]["Id"];
                    userId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @default Admin avatar frame ownership change */
                        reason?: string;
                    };
                };
            };
            responses: {
                /** @description Ownership granted; retry is a no-op */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            changed: boolean;
                        };
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chapters/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Chapter reader payload */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterDetail"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chapters/{id}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Visible comments for a readable chapter */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterCommentList"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @example Cảm ơn nhóm dịch! */
                        body: string;
                        /**
                         * Format: uuid
                         * @description Reuse the same ID when retrying comment creation
                         */
                        operationId?: string;
                        parentId?: components["schemas"]["Id"];
                    };
                };
            };
            responses: {
                /** @description Created chapter comment */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterComment"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Comment state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Comment cooldown or duplicate content window */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chapters/{id}/navigation-releases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query: {
                    direction: "previous" | "next";
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Readable release summaries for the adjacent logical chapter, without page manifests */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterNavigationReleases"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chapters/{id}/view": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CompleteChapterViewInput"];
                };
            };
            responses: {
                /** @description Chapter view tracking result */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterViewResult"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description View session is invalid or expired */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Chapter not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description View tracking is not configured */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chapters/{id}/view-session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description A server-timed anonymous chapter view session */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterViewSession"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Chapter not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description View tracking is not configured */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/chapters/latest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Latest readable chapters with manga identity */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LatestChapterList"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/comments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Soft-deleted comment */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterComment"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Comment state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @example Cảm ơn nhóm dịch! */
                        body: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Updated comment */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterComment"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Comment state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/comments/recent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Latest visible comments across manga and chapters */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecentCommentList"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["GroupInput"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["GroupInput"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/avatar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        image: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/banner": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        image: string;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupManagement"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/coin-wallet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Group balance for its leader/admin */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CoinWallet"];
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Account, membership or origin denied */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Group not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Insufficient balance or idempotency conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description SuicaoCoin disabled */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/coin-wallet/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Group ledger for its leader/admin */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CoinHistory"];
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Account, membership or origin denied */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Group not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Insufficient balance or idempotency conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description SuicaoCoin disabled */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/coin-wallet/transfers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CoinTransferInput"];
                };
            };
            responses: {
                /** @description Committed transfer, or original receipt on retry; no recipient balance disclosed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CoinTransfer"];
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Account, membership or origin denied */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Group not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Insufficient balance or idempotency conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description SuicaoCoin disabled */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/leader": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        userId: string;
                    };
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    publicationState?: "published" | "hidden";
                    q?: string;
                };
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementSummary"][];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["MangaCreateInput"];
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["MangaUpdateInput"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadSession"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadSession"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Upload session cancelled */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads/{sessionId}/commit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ChapterCreateInput"];
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads/{sessionId}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ChapterUploadDiagnostic"];
                };
            };
            responses: {
                /** @description Client diagnostic logged */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads/{sessionId}/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        pageIds: components["schemas"]["Id"][];
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadSession"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads/{sessionId}/pages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        page: string;
                        pageId: components["schemas"]["Id"];
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadPage"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapter-uploads/{sessionId}/pages/{pageId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    pageId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Staging page deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    direction?: components["schemas"]["SortDirection"];
                    limit?: number;
                    page?: number;
                    publicationState?: "draft" | "published";
                    sort?: "volume" | "chapter" | "updatedAt";
                };
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementSummary"][];
                            meta: components["schemas"]["PageMeta"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ChapterCreateInput"];
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ChapterUpdateInput"];
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Chapter deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {string} */
                        mode: "initial" | "replacement";
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadSession"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}/uploads/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadSession"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Upload session cancelled */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}/uploads/{sessionId}/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ChapterUploadDiagnostic"];
                };
            };
            responses: {
                /** @description Client diagnostic logged */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}/uploads/{sessionId}/finalize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ChapterFinalizeInput"];
                };
            };
            responses: {
                /** @description Success */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}/uploads/{sessionId}/order": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        pageIds: components["schemas"]["Id"][];
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadSession"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}/uploads/{sessionId}/pages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        page: string;
                        pageId: components["schemas"]["Id"];
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ChapterUploadPage"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/chapters/{chapterId}/uploads/{sessionId}/pages/{pageId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: components["schemas"]["Id"];
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    pageId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Staging page deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/cover": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        cover: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["Cover"] & {
                                version: number;
                            };
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/cover-uploads/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                    mangaId: components["schemas"]["Id"];
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["Cover"] & {
                                version: number;
                            };
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        hidden: boolean;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaManagementDetail"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/volumes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        number: string | number;
                    };
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: components["schemas"]["Id"];
                                number: string;
                            };
                            mangaVersion: number;
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/{mangaId}/volumes/{volumeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    volumeId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        number: string | number;
                    };
                };
            };
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: components["schemas"]["Id"];
                                number: string;
                            };
                            mangaVersion: number;
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                    mangaId: components["schemas"]["Id"];
                    volumeId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/cover-uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        cover: string;
                        expectedVersion?: number;
                        mangaId?: components["schemas"]["Id"];
                    };
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                expiresAt: components["schemas"]["Timestamp"];
                                height: number;
                                id: components["schemas"]["Id"];
                                /** Format: uri */
                                previewUrl: string;
                                width: number;
                            };
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/manga/cover-uploads/{sessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                    sessionId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Upload session cancelled */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    status?: "pending" | "approved" | "rejected";
                };
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GroupMembership"][];
                            meta: {
                                hasMore: boolean;
                                limit: number;
                                page: number;
                            };
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        userId: string;
                    };
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/members/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                    userId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/members/{userId}/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                    userId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["GroupPermissions"];
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/membership": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/people": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PersonCreateInput"];
                };
            };
            responses: {
                /** @description Success */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["PersonSummary"];
                        };
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/requests/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                    userId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        action: "approve" | "reject";
                    };
                };
            };
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/contribution/groups/{groupId}/requests/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Mutation committed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    q?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Public translation groups in deterministic order */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TranslationGroupList"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Translation group metadata and public statistics */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TranslationGroupDetail"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/manga": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    artist?: string[];
                    author?: string[];
                    direction?: "asc" | "desc";
                    excludeTag?: string[];
                    excludeTagMode?: "and" | "or";
                    group?: string[];
                    hasChapter?: "true" | "false" | "all";
                    includeTag?: string[];
                    includeTagMode?: "and" | "or";
                    language?: string;
                    limit?: number;
                    page?: number;
                    q?: string;
                    sort?: "latestChapter" | "publishedAt" | "title" | "year";
                    status?: "ongoing" | "completed" | "hiatus" | "cancelled";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Visible manga summaries matching the catalog query */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MangaList"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/manga/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Manga detail */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MangaDetail"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/manga/{id}/chapters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    direction?: components["schemas"]["SortDirection"];
                    language?: string;
                    limit?: number;
                    page?: number;
                    sort?: "reading" | "volume";
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Readable chapters */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterList"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/manga/{id}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Visible manga and readable chapter comments */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterCommentList"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @example Cảm ơn nhóm dịch! */
                        body: string;
                        /**
                         * Format: uuid
                         * @description Reuse the same ID when retrying comment creation
                         */
                        operationId?: string;
                        parentId?: components["schemas"]["Id"];
                    };
                };
            };
            responses: {
                /** @description Created manga comment */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChapterComment"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Comment state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Comment cooldown or duplicate content window */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/manga/{id}/reading-entry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query: {
                    position: "first" | "last";
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description All readable releases in the first slot of the volume-sorted chapter list (first: ascending, last: descending) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MangaReadingEntry"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/manga/{id}/recommendations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Related manga by author and shared genre or theme */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MangaRecommendations"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/manga/random": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Up to 10 random visible manga, selected once per limit every 10 minutes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RandomManga"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The authenticated account and application profile */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CurrentAccount"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/avatar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        avatar: string;
                    };
                };
            };
            responses: {
                /** @description The account with its updated avatar */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CurrentAccount"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot perform this action */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The uploaded image is too large */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Profile media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The account after removing its avatar */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CurrentAccount"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot perform this action */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Profile media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/avatar-frame": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        frameId: components["schemas"]["Id"];
                    };
                };
            };
            responses: {
                /** @description Updated account */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CurrentAccount"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Updated account */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CurrentAccount"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/avatar-frames": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Owned frames, including disabled frames */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AvatarFrameInventory"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Action is not allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Frame state changed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds limit */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Image processor is busy */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Media storage is unavailable */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/coin-wallet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Private personal balance; zero for an uncreated wallet */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CoinWallet"];
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Account, membership or origin denied */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Group not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Insufficient balance or idempotency conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description SuicaoCoin disabled */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/coin-wallet/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Private ledger, descending sequence */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CoinHistory"];
                    };
                };
                /** @description Invalid input */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Account, membership or origin denied */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Group not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Insufficient balance or idempotency conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description SuicaoCoin disabled */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Success */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MyGroup"];
                    };
                };
                /** @description Success */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Success */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/library": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    category?: components["schemas"]["LibraryCategory"];
                    cursor?: string;
                    limit?: number;
                    q?: string;
                    sort?: components["schemas"]["LibrarySort"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own visible library, filtered and sorted */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["LibraryItem"][];
                            meta: {
                                limit: number;
                                nextCursor: components["schemas"]["Id"] | null;
                            };
                        };
                    };
                };
                /** @description Invalid input or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/library/{mangaId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    mangaId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own library item, or null if not added */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["LibraryItem"] | null;
                        };
                    };
                };
                /** @description Invalid input or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Manga is not visible */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    mangaId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PutLibraryItem"];
                };
            };
            responses: {
                /** @description Library item after the account's category change */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["LibraryItem"];
                        };
                    };
                };
                /** @description Invalid input or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot modify its library */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Manga is not visible */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    mangaId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own item deleted, or already absent */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Invalid input or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own visible notifications, newest first */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: (components["schemas"]["MangaNewChapterNotification"] | components["schemas"]["GroupNotification"] | components["schemas"]["SystemNoticeNotification"])[];
                            meta: {
                                limit: number;
                                nextCursor: components["schemas"]["Id"] & (string | null);
                                unreadCount: number;
                            };
                        };
                    };
                };
                /** @description Invalid input or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/notifications/{notificationId}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    notificationId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Notification marked as read, idempotently */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: components["schemas"]["Id"];
                                readAt: components["schemas"]["Timestamp"];
                            };
                            meta: {
                                unreadCount: number;
                            };
                        };
                    };
                };
                /** @description Invalid input or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot modify notifications */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Notification is not visible */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description All own visible notifications through the cutoff marked read */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                cutoff: components["schemas"]["Timestamp"];
                                updated: number;
                            };
                            meta: {
                                unreadCount: number;
                            };
                        };
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot modify notifications */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["UpdateProfile"];
                };
            };
            responses: {
                /** @description The updated authenticated profile */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CurrentAccount"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot perform this action */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/me/reading-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own visible reading history, newest first */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ReadingHistoryItem"][];
                            meta: {
                                limit: number;
                                nextCursor: components["schemas"]["Id"] & (string | null);
                            };
                        };
                    };
                };
                /** @description Invalid input, timestamp or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/reading-history/manga": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own visible reading history grouped by manga, with three newest chapters */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["MangaReadingHistoryItem"][];
                            meta: {
                                limit: number;
                                nextCursor: components["schemas"]["Id"] & (string | null);
                            };
                        };
                    };
                };
                /** @description Invalid input, timestamp or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/reading-history/merge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["MergeHistoryInput"];
                };
            };
            responses: {
                /** @description Atomic batch with per-entry acknowledgement; entries without readAt are insert-only */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MergeHistoryResult"];
                    };
                };
                /** @description Invalid input, timestamp or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot merge history */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/reading-progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query: {
                    mangaId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own read-map for readable chapters of a manga */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ReadingProgress"][];
                        };
                    };
                };
                /** @description Invalid input, timestamp or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content is not visible or readable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/reading-progress/{chapterId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own chapter progress, or null if unread */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ReadingProgress"] | null;
                        };
                    };
                };
                /** @description Invalid input, timestamp or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content is not visible or readable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ProgressInput"];
                };
            };
            responses: {
                /** @description Canonical progress after conflict resolution */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ReadingProgress"];
                        };
                    };
                };
                /** @description Invalid input, timestamp or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description The account cannot write progress */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Content is not visible or readable */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chapterId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Own progress deleted, or already absent */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Invalid input, timestamp or cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Authentication is required */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/shop/avatar-frames": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    q?: string;
                    rarity?: "R" | "SR" | "SSR";
                    topicId?: components["schemas"]["Id"] | "none";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shop catalog */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            balance: string;
                            data: components["schemas"]["PersonalShopAvatarFrame"][];
                            meta: components["schemas"]["PageMeta"];
                            purchaseEnabled: boolean;
                        };
                    };
                };
                /** @description Shop catalog */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/shop/chests/{chestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chestId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Gacha response */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PersonalShopChest"];
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/shop/gacha-rolls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Private history by descending personal debit ledger sequence, available with features disabled */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GachaHistory"];
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["GachaRollInput"];
                };
            };
            responses: {
                /** @description Committed roll or original receipt on retry; refetch wallet/inventory/pity for current state */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GachaReceipt"];
                        };
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Quote, pool, balance or operation ID conflict; closed chest */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds 16 KiB */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/shop/gacha-rolls/{operationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    operationId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Actor-only immutable receipt; missing or another actor's receipt returns 404, even with features disabled */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["GachaReceipt"];
                        };
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/shop/purchases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Private purchase history, descending personal debit sequence; available with features disabled */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShopPurchaseHistory"];
                    };
                };
                /** @description Shop catalog */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ShopPurchaseInput"];
                };
            };
            responses: {
                /** @description Committed purchase or original receipt on retry; refetch wallet/inventory for current state */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ShopPurchaseReceipt"];
                        };
                    };
                };
                /** @description Shop catalog */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Quote, ownership, stock, balance or operation ID conflict */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Request body exceeds 16 KiB */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/shop/purchases/{operationId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    operationId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Private immutable purchase receipt; missing or another actor's receipt returns 404 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ShopPurchaseReceipt"];
                        };
                    };
                };
                /** @description Shop catalog */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/people": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    id?: string[];
                    limit?: number;
                    q?: string;
                    role?: "author" | "artist";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description All people, or people attached to visible manga when filtered by role */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PersonList"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/people/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Person metadata and public roles */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PersonDetail"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/profiles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description A public active profile by user ID, with public groups and the five latest visible comments */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PublicProfile"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Profile not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/rankings/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    window?: "day" | "week" | "month" | "all-time";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Ranked public translation groups for one time window */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GroupRanking"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/rankings/manga": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    metric?: "score" | "views" | "follows" | "comments";
                    window?: "day" | "week" | "month" | "all-time";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Ranked public manga for one metric and time window */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MangaRanking"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shop/avatar-frame-topics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shop catalog */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                frameCount: number;
                                id: components["schemas"]["Id"];
                                name: string;
                            }[];
                        };
                    };
                };
                /** @description Shop catalog */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shop/avatar-frames": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    q?: string;
                    rarity?: "R" | "SR" | "SSR";
                    topicId?: components["schemas"]["Id"] | "none";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shop catalog */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ShopAvatarFrame"][];
                            meta: components["schemas"]["PageMeta"];
                            purchaseEnabled: boolean;
                        };
                    };
                };
                /** @description Shop catalog */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shop/avatar-frames/{frameId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    frameId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Shop catalog */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["ShopAvatarFrame"];
                            purchaseEnabled: boolean;
                        };
                    };
                };
                /** @description Shop catalog */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Shop catalog */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shop/chests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Gacha response */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShopChestCatalog"];
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shop/chests/{chestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    chestId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Gacha response */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShopChestDetail"];
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/shop/chests/{chestId}/pool": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    limit?: number;
                    page?: number;
                    rarity?: "R" | "SR" | "SSR";
                };
                header?: never;
                path: {
                    chestId: components["schemas"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Gacha response */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShopChestPool"];
                    };
                };
                /** @description Gacha response */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Rate limit exceeded */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Gacha response */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sitemap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Number of sitemap pages for each public resource */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SitemapIndex"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/sitemap/{resource}/{page}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    page: number | null;
                    resource: components["schemas"]["SitemapResource"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Canonical paths in stable ID order, up to 10000 per page */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SitemapPage"];
                    };
                };
                /** @description Invalid sitemap resource or page */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Sitemap page does not exist */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/system-notices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Published system notices, newest first */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: components["schemas"]["SystemNotice"][];
                            meta: {
                                limit: number;
                                nextCursor: components["schemas"]["Id"] & (string | null);
                            };
                        };
                    };
                };
                /** @description Invalid cursor */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Public tag taxonomy in deterministic order */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TagList"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Tag metadata */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TagSummary"];
                    };
                };
                /** @description Request validation failed */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
                /** @description Resource not found */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiError"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AdminAuditEntry: {
            action: string;
            actor: {
                avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
                id: string;
                image: string | null;
                name: string;
            } | null;
            actorUserId: string | null;
            after: {
                [key: string]: unknown;
            } | null;
            before: {
                [key: string]: unknown;
            } | null;
            createdAt: components["schemas"]["Timestamp"];
            id: components["schemas"]["Id"];
            reason: string;
            targetId: string;
            /** @enum {string} */
            targetKind: "user" | "manga" | "volume" | "chapter" | "comment" | "group" | "person" | "tag" | "image_server2" | "system_notice" | "avatar_frame" | "avatar_frame_topic" | "shop_chest";
        };
        AdminAvatarFrame: {
            active: boolean;
            byteSize: number | null;
            code: components["schemas"]["Slug"];
            createdAt: components["schemas"]["Timestamp"];
            description: string;
            displayScale: number;
            frame: components["schemas"]["AvatarFrameSummary"] | null;
            frameCount: number | null;
            id: components["schemas"]["Id"];
            limited: boolean;
            name: string;
            offsetX: number;
            offsetY: number;
            previewByteSize: number | null;
            /** @enum {string} */
            rarity: "R" | "SR" | "SSR";
            sha256: string | null;
            shop: {
                price: string | null;
                stock: number;
                version: number;
            };
            sourceSha256: string | null;
            topicId: components["schemas"]["Id"] | null;
            updatedAt: components["schemas"]["Timestamp"];
            version: number;
        };
        AdminComment: {
            author: {
                avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
                id: string;
                image: string | null;
                name: string;
            };
            body: string;
            chapter: {
                id: components["schemas"]["Id"];
                number: string | null;
                title: string | null;
                volume: string | null;
            } | null;
            createdAt: components["schemas"]["Timestamp"];
            editedAt: components["schemas"]["Timestamp"] & (string | null);
            id: components["schemas"]["Id"];
            manga: {
                id: components["schemas"]["Id"];
                slug: string;
                title: string;
            };
            parentId: components["schemas"]["Id"] & (string | null);
            /** @enum {string} */
            status: "visible" | "hidden";
            updatedAt: components["schemas"]["Timestamp"];
            version: number;
        };
        AdminGroupManagement: components["schemas"]["GroupManagement"] & {
            creator: {
                id: string;
                name: string;
            } | null;
        };
        AdminTag: {
            /** @enum {string} */
            group: "content" | "format" | "genre" | "theme";
            id: components["schemas"]["Id"];
            mangaCount: number;
            moderationHiddenAt: components["schemas"]["Timestamp"] & (string | null);
            name: string;
            slug: components["schemas"]["Slug"];
            version: number;
        };
        AdminUserDetail: components["schemas"]["AdminUserSummary"] & {
            bio: string | null;
            isPublic: boolean;
            linkedProviders: string[];
            moderatedByUserId: string | null;
            moderationReason: string | null;
        };
        AdminUserSession: {
            createdAt: components["schemas"]["Timestamp"];
            expiresAt: components["schemas"]["Timestamp"];
            id: string;
            ipAddress: string | null;
            userAgent: string | null;
        };
        AdminUserSummary: {
            avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
            createdAt: components["schemas"]["Timestamp"];
            /** Format: email */
            email: string;
            emailVerified: boolean;
            id: string;
            image: string | null;
            isAdmin: boolean;
            moderatedAt: components["schemas"]["Timestamp"] & (string | null);
            name: string;
            /** @enum {string} */
            status: "active" | "suspended" | "banned";
            updatedAt: components["schemas"]["Timestamp"];
            version: number;
        };
        ApiError: {
            error: {
                code: string;
                details?: {
                    message: string;
                    path: string;
                }[];
                message: string;
                requestId: string;
            };
        };
        AvatarFrameInventory: {
            data: {
                active: boolean;
                frame: components["schemas"]["AvatarFrameSummary"];
                grantedAt: components["schemas"]["Timestamp"];
                limited: boolean;
                /** @enum {string} */
                rarity: "R" | "SR" | "SSR";
                selected: boolean;
                topic: {
                    id: components["schemas"]["Id"];
                    name: string;
                } | null;
            }[];
            enabled: boolean;
            meta: components["schemas"]["PageMeta"];
            selectedFrameId: components["schemas"]["Id"] & (string | null);
        };
        AvatarFrameSummary: {
            animated: boolean;
            /** Format: uri */
            assetUrl: string;
            displayScale: number;
            height: number;
            id: components["schemas"]["Id"];
            name: string;
            offsetX: number;
            offsetY: number;
            /** Format: uri */
            previewUrl: string;
            width: number;
        };
        AvatarFrameTopic: {
            id: components["schemas"]["Id"];
            name: string;
            version: number;
        };
        ChapterComment: {
            author: {
                avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
                id: string;
                image: string | null;
                name: string;
            };
            body: string | null;
            chapter: {
                id: components["schemas"]["Id"];
                number: string | null;
                title: string | null;
            } | null;
            createdAt: components["schemas"]["Timestamp"];
            deleted: boolean;
            editedAt: components["schemas"]["Timestamp"] & (string | null);
            hidden: boolean;
            id: components["schemas"]["Id"];
            parentId: components["schemas"]["Id"] & (string | null);
            replies: {
                author: {
                    avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
                    id: string;
                    image: string | null;
                    name: string;
                };
                body: string | null;
                chapter: {
                    id: components["schemas"]["Id"];
                    number: string | null;
                    title: string | null;
                } | null;
                createdAt: components["schemas"]["Timestamp"];
                deleted: boolean;
                editedAt: components["schemas"]["Timestamp"] & (string | null);
                hidden: boolean;
                id: components["schemas"]["Id"];
                parentId: components["schemas"]["Id"];
                updatedAt: components["schemas"]["Timestamp"];
                version: number;
            }[];
            updatedAt: components["schemas"]["Timestamp"];
            version: number;
        };
        ChapterCommentList: {
            data: components["schemas"]["ChapterComment"][];
            meta: {
                limit: number;
                nextCursor: components["schemas"]["Id"] & (string | null);
                total: number;
            };
        };
        ChapterCreateInput: {
            /** @default [] */
            groupIds: components["schemas"]["Id"][];
            /** @default vi */
            language: string;
            /** @default null */
            number: string | number | null;
            /** @default null */
            title: string | null;
            /** @default null */
            volumeNumber: string | number | null;
        };
        ChapterDetail: components["schemas"]["ChapterSummary"] & {
            manga: {
                cover: components["schemas"]["Cover"];
                id: components["schemas"]["Id"];
                isLongStrip: boolean;
                slug: components["schemas"]["Slug"];
                title: string;
            };
            navigation: {
                alternatives: {
                    groups: {
                        id: components["schemas"]["Id"];
                        name: string;
                        slug: components["schemas"]["Slug"];
                    }[];
                    id: components["schemas"]["Id"];
                    language: string;
                    number: string | null;
                    title: string | null;
                    volume: string | null;
                }[];
                next: components["schemas"]["ChapterNavigationChoice"];
                previous: components["schemas"]["ChapterNavigationChoice"];
            };
            next: {
                groups: {
                    id: components["schemas"]["Id"];
                    name: string;
                    slug: components["schemas"]["Slug"];
                }[];
                id: components["schemas"]["Id"];
                language: string;
                number: string | null;
                title: string | null;
                volume: string | null;
            } | null;
            pages: {
                height: number;
                optimizedHeight: number | null;
                /** Format: uri */
                optimizedUrl: string | null;
                optimizedWidth: number | null;
                position: number;
                /** Format: uri */
                replicaUrl: string | null;
                /** Format: uri */
                url: string;
                width: number;
            }[];
            pagesVersion: number;
            previous: {
                groups: {
                    id: components["schemas"]["Id"];
                    name: string;
                    slug: components["schemas"]["Slug"];
                }[];
                id: components["schemas"]["Id"];
                language: string;
                number: string | null;
                title: string | null;
                volume: string | null;
            } | null;
        };
        ChapterFinalizeInput: {
            expectedVersion: number;
            pageIds: components["schemas"]["Id"][];
        };
        ChapterList: {
            data: components["schemas"]["ChapterSummary"][];
            meta: components["schemas"]["PageMeta"] & {
                releaseTotal: number;
            };
            slots: components["schemas"]["ChapterSlot"][];
        };
        ChapterManagementDetail: components["schemas"]["ChapterManagementSummary"] & {
            activeUploadSession: {
                expiresAt: components["schemas"]["Timestamp"];
                failureReason: string | null;
                id: components["schemas"]["Id"];
                /** @enum {string} */
                mode: "initial" | "replacement";
                /** @enum {string} */
                processingState: "idle" | "queued" | "processing" | "failed";
                readyPageCount: number;
                /** @enum {string} */
                state: "open" | "finalizing";
            } | null;
            createdAt: components["schemas"]["Timestamp"];
            groups: {
                id: string;
                name: string;
                slug: string;
            }[];
            ownerGroup: {
                id: string;
                name: string;
                slug: string;
            };
            publishedAt: components["schemas"]["Timestamp"] & (string | null);
        };
        ChapterManagementSummary: {
            availablePageCount: number;
            id: components["schemas"]["Id"];
            isDefault: boolean;
            isFull: boolean;
            isOwner: boolean;
            language: string;
            mangaId: components["schemas"]["Id"];
            moderationHiddenAt: components["schemas"]["Timestamp"] & (string | null);
            moderationReason: string | null;
            number: string | null;
            ownerGroupId: components["schemas"]["Id"];
            pageCount: number;
            /** @enum {string} */
            processingState: "idle" | "queued" | "processing" | "failed";
            /** @enum {string} */
            publicationState: "draft" | "published";
            stagedPageCount: number;
            title: string | null;
            updatedAt: components["schemas"]["Timestamp"];
            version: number;
            volume: {
                id: components["schemas"]["Id"];
                number: string;
            } | null;
        };
        ChapterNavigationChoice: {
            options: {
                groups: {
                    id: components["schemas"]["Id"];
                    name: string;
                    slug: components["schemas"]["Slug"];
                }[];
                id: components["schemas"]["Id"];
                language: string;
                number: string | null;
                title: string | null;
                volume: string | null;
            }[];
            selectedChapterId: components["schemas"]["Id"] & (string | null);
            /** @enum {string} */
            state: "boundary" | "ready" | "choice-required" | "unordered";
        };
        ChapterNavigationReleases: {
            data: components["schemas"]["ChapterSummary"][];
        };
        ChapterSlot: {
            automaticOrder: boolean;
            defaultChapterId: components["schemas"]["Id"] & (string | null);
            key: string;
            language: string;
            number: string | null;
            releases: components["schemas"]["ChapterSummary"][];
            volume: string | null;
        };
        ChapterSummary: {
            groups: {
                id: components["schemas"]["Id"];
                name: string;
                slug: components["schemas"]["Slug"];
            }[];
            id: components["schemas"]["Id"];
            isDefault: boolean;
            language: string;
            number: string | null;
            pageCount: number;
            publishedAt: components["schemas"]["Timestamp"];
            statistics: {
                comments: number;
                views: number;
            };
            title: string | null;
            uploader: {
                id: string | null;
                name: string;
            };
            volume: string | null;
        };
        ChapterUpdateInput: {
            expectedVersion: number;
            /** @default vi */
            language: string;
            /** @default null */
            number: string | number | null;
            /** @default null */
            title: string | null;
            uploadSessionId?: components["schemas"]["Id"];
            /** @default null */
            volumeNumber: string | number | null;
        };
        ChapterUploadDiagnostic: {
            elapsedMs: number;
            /** @enum {string} */
            outcome: "timeout" | "network_error" | "aborted" | "http_error";
            pageId: components["schemas"]["Id"];
            sourceBytes: number;
            status: number;
            totalBytes: number;
            transferComplete: boolean;
            transferredBytes: number;
            uploadRequestId: components["schemas"]["Id"];
        };
        ChapterUploadPage: {
            createdAt: components["schemas"]["Timestamp"];
            height: number | null;
            id: components["schemas"]["Id"];
            /** Format: uri */
            previewUrl: string | null;
            sourceByteSize: number | null;
            /** @enum {string} */
            state: "uploading" | "ready" | "deleting";
            storedByteSize: number | null;
            updatedAt: components["schemas"]["Timestamp"];
            width: number | null;
        };
        ChapterUploadSession: {
            chapterId: components["schemas"]["Id"] & (string | null);
            createdAt: components["schemas"]["Timestamp"];
            expectedChapterVersion: number | null;
            expiresAt: components["schemas"]["Timestamp"];
            failureReason: string | null;
            id: components["schemas"]["Id"];
            mangaId: components["schemas"]["Id"];
            /** @enum {string} */
            mode: "initial" | "replacement";
            orderedPageIds: components["schemas"]["Id"][];
            pages: components["schemas"]["ChapterUploadPage"][];
            /** @enum {string} */
            processingState: "idle" | "queued" | "processing" | "failed";
            /** @enum {string} */
            state: "open" | "finalizing" | "completed" | "cancelled" | "cleaning" | "cleaned";
            updatedAt: components["schemas"]["Timestamp"];
        };
        ChapterViewResult: {
            alreadyCounted: boolean;
            counted: boolean;
            requiredPages: number;
            retryAfterSeconds: number;
            seenPages: number;
            seenSeconds: number;
            trackingAvailable: boolean;
            viewCount: number;
        };
        ChapterViewSession: {
            requiredPages: number;
            requiredSeconds: number;
            token: string;
        };
        CoinHistory: {
            data: {
                actorUserId: string | null;
                balanceAfter: string;
                createdAt: components["schemas"]["Timestamp"];
                delta: string;
                /** Format: uuid */
                id: string;
                /** @enum {string} */
                mode: "credit" | "debit" | "penalty";
                /** Format: uuid */
                referenceLedgerId: string | null;
                requestedAmount: string;
                sequence: string;
                sourceId: string;
                sourceType: string;
                /** Format: uuid */
                transactionGroup: string;
            }[];
            meta: {
                limit: number;
                nextCursor: string | null;
            };
        };
        CoinTransfer: {
            amount: string;
            balanceAfter: string;
            createdAt: components["schemas"]["Timestamp"];
            groupId: string;
            /** Format: uuid */
            operationId: string;
            recipientUserId: string;
            /** Format: uuid */
            transactionGroup: string;
        };
        CoinTransferInput: {
            amount: string;
            /** Format: uuid */
            operationId: string;
            recipientUserId: string;
        };
        CoinWallet: {
            balance: string;
        };
        CompleteChapterViewInput: {
            seenPages: number;
            token: string;
        };
        Cover: {
            height: number | null;
            /** Format: uri */
            url: string;
            width: number | null;
        } | null;
        CurrentAccount: {
            coinBalance: string;
            linkedProviders: string[];
            profile: components["schemas"]["OwnProfile"];
            user: {
                avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
                createdAt: components["schemas"]["Timestamp"];
                email: string;
                emailVerified: boolean;
                id: string;
                image: string | null;
                name: string;
                /**
                 * @description Display-only role; never use for authorization
                 * @enum {string}
                 */
                role: "user" | "member" | "leader" | "admin";
                updatedAt: components["schemas"]["Timestamp"];
            };
        };
        ForbiddenWord: {
            createdAt: components["schemas"]["Timestamp"];
            id: components["schemas"]["Id"];
            word: string;
        };
        GachaHistory: {
            data: components["schemas"]["GachaReceipt"][];
            meta: {
                limit: number;
                nextCursor: string | null;
            };
        };
        GachaReceipt: {
            balanceAfter: string;
            chest: {
                id: components["schemas"]["Id"];
                /** @enum {string} */
                kind: "common" | "topic";
                name: string;
                topicId: components["schemas"]["Id"] & (string | null);
                version: number;
            };
            createdAt: components["schemas"]["Timestamp"];
            debitLedgerId: components["schemas"]["Id"];
            duplicate: boolean;
            frame: {
                code: components["schemas"]["Slug"];
                id: components["schemas"]["Id"];
                name: string;
                /** @enum {string} */
                rarity: "R" | "SR" | "SSR";
            };
            id: components["schemas"]["Id"];
            operationId: components["schemas"]["Id"];
            pity: {
                after: {
                    sinceSr: number;
                    sinceSsr: number;
                };
                before: {
                    sinceSr: number;
                    sinceSsr: number;
                };
                rollSequence: string;
            };
            poolDigest: string;
            price: string;
            refund: string;
            refundLedgerId: components["schemas"]["Id"] & (string | null);
            ruleVersion: number;
            sequence: string;
            transactionGroup: components["schemas"]["Id"];
        };
        GachaRollInput: {
            chestId: components["schemas"]["Id"];
            expectedChestVersion: number;
            expectedPoolDigest: string;
            expectedPrice: string;
            expectedRuleVersion: number;
            operationId: components["schemas"]["Id"];
        };
        GachaRule: {
            duplicateRefund: {
                /** @enum {string} */
                R: "1";
                /** @enum {string} */
                SR: "5";
                /** @enum {string} */
                SSR: "20";
            };
            /** @enum {string} */
            price: "5";
            /** @enum {number} */
            rateDenominator: 10000;
            rates: {
                /** @enum {number} */
                R: 8750;
                /** @enum {number} */
                SR: 1000;
                /** @enum {number} */
                SSR: 250;
            };
            /** @enum {number} */
            srPity: 10;
            /** @enum {number} */
            ssrPity: 50;
            /** @enum {number} */
            version: 1;
        };
        GroupInput: {
            /** @default  */
            description: string;
            /** @default {} */
            links: {
                discord?: string;
                facebook?: string;
                twitter?: string;
                website?: string;
            };
            name: string;
        };
        GroupManagement: {
            /** @enum {string} */
            approvalStatus: "pending" | "approved" | "rejected";
            /** Format: uri */
            avatarUrl: string | null;
            /** Format: uri */
            bannerUrl: string | null;
            createdAt: components["schemas"]["Timestamp"];
            description: string | null;
            id: components["schemas"]["Id"];
            inactive: boolean;
            links: {
                [key: string]: string;
            };
            name: string;
            /** @enum {string} */
            publicationState: "draft" | "published" | "hidden";
            slug: string;
            updatedAt: components["schemas"]["Timestamp"];
        };
        GroupMembership: {
            avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
            createdAt: components["schemas"]["Timestamp"];
            name: string;
            permissions: components["schemas"]["GroupPermissions"];
            /** @enum {string} */
            role: "leader" | "member";
            /** @enum {string} */
            status: "pending" | "approved" | "rejected";
            userId: string;
        };
        GroupNotification: {
            actor: {
                id: string;
                name: string;
            } | null;
            createdAt: components["schemas"]["Timestamp"];
            group: {
                id: components["schemas"]["Id"];
                name: string;
            };
            id: components["schemas"]["Id"];
            readAt: components["schemas"]["Timestamp"] & (string | null);
            /** @enum {string} */
            type: "group_join_requested" | "group_join_approved" | "group_join_rejected" | "group_member_removed" | "group_member_left" | "group_approved" | "group_rejected" | "content_group_added" | "group_leader_assigned";
        };
        GroupPermissions: {
            canAddChapter: boolean;
            canAddManga: boolean;
            canDeleteChapter: boolean;
            canDeleteManga: boolean;
            canEditChapter: boolean;
            canEditManga: boolean;
        };
        GroupRanking: {
            data: {
                chapters: number;
                group: components["schemas"]["TranslationGroupSummary"];
                rank: number;
                releases: number;
                score: number;
                views: number;
            }[];
            meta: {
                bucketDate: string;
                /** Format: date-time */
                calculatedAt: string;
                limit: number;
                /** @enum {string} */
                window: "day" | "week" | "month" | "all-time";
            };
        };
        Health: {
            /** @enum {string} */
            status: "ok";
        };
        /**
         * Format: uuid
         * @example e9aa16d2-66de-4c1f-b85c-e48e4a1a92c2
         */
        Id: string;
        ImageServer2BatchInput: {
            /** @enum {string} */
            action: "enqueue" | "retry";
            chapterIds?: components["schemas"]["Id"][];
            mangaIds?: components["schemas"]["Id"][];
        };
        ImageServer2BatchResult: {
            applied: number;
            errors: {
                chapterId: components["schemas"]["Id"];
                code: string;
            }[];
            hasMore: boolean;
            skipped: number;
        };
        ImageServer2Chapter: {
            attempts: number;
            id: components["schemas"]["Id"];
            lastErrorCode: string | null;
            nextRetryAt: components["schemas"]["Timestamp"] & (string | null);
            number: string | null;
            pagesVersion: number;
            sourceVersion: number | null;
            /** @enum {string} */
            state: "missing" | "stale" | "pending" | "running" | "retry_wait" | "ready" | "failed";
            title: string | null;
            total: number;
            updatedAt: components["schemas"]["Timestamp"] & (string | null);
            verified: number;
        };
        ImageServer2ChapterList: {
            data: components["schemas"]["ImageServer2Chapter"][];
            manga: {
                id: components["schemas"]["Id"];
                title: string;
            };
            meta: {
                hasMore: boolean;
                limit: number;
                page: number;
            };
        };
        ImageServer2Manga: {
            chapters: number;
            failed: number;
            id: components["schemas"]["Id"];
            queued: number;
            ready: number;
            running: number;
            slug: string;
            title: string;
        };
        ImageServer2MangaList: {
            data: components["schemas"]["ImageServer2Manga"][];
            meta: {
                hasMore: boolean;
                limit: number;
                page: number;
            };
        };
        ImageServer2Worker: {
            enabled: boolean;
            readEnabled: boolean;
            uploadConfigured: boolean;
        };
        LatestChapterList: {
            data: (components["schemas"]["ChapterSummary"] & {
                manga: {
                    cover: components["schemas"]["Cover"];
                    id: components["schemas"]["Id"];
                    slug: components["schemas"]["Slug"];
                    title: string;
                };
            })[];
            meta: components["schemas"]["PageMeta"];
        };
        /** @enum {string} */
        LibraryCategory: "following" | "reading" | "plan" | "completed";
        LibraryItem: {
            category: components["schemas"]["LibraryCategory"];
            createdAt: components["schemas"]["Timestamp"];
            manga: components["schemas"]["MangaSummary"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        /**
         * @default addedAt
         * @enum {string}
         */
        LibrarySort: "addedAt" | "latestChapter";
        MangaCreateInput: {
            /** @default [] */
            alternativeTitles: string[];
            /** @default [] */
            artistIds: components["schemas"]["Id"][];
            /** @default [] */
            authorIds: components["schemas"]["Id"][];
            /** @enum {string} */
            contentRating: "safe" | "suggestive" | "erotica";
            coverUploadId?: components["schemas"]["Id"];
            /** @default null */
            description: string | null;
            /** @default [] */
            groupIds: components["schemas"]["Id"][];
            /** @default null */
            lastChapter: string | null;
            /** @default null */
            lastVolume: string | null;
            /** @default {} */
            links: {
                /** Format: uri */
                al?: string;
                /** Format: uri */
                amz?: string;
                /** Format: uri */
                ap?: string;
                /** Format: uri */
                bw?: string;
                /** Format: uri */
                cdj?: string;
                /** Format: uri */
                ebj?: string;
                /** Format: uri */
                engtl?: string;
                /** Format: uri */
                kt?: string;
                /** Format: uri */
                mal?: string;
                /** Format: uri */
                mu?: string;
                /** Format: uri */
                raw?: string;
            };
            originalLanguage: string;
            /**
             * @default null
             * @enum {string|null}
             */
            publicationDemographic: "shounen" | "shoujo" | "josei" | "seinen" | null;
            slug?: components["schemas"]["Slug"];
            /** @enum {string} */
            status: "ongoing" | "completed" | "hiatus" | "cancelled";
            /** @default [] */
            tagIds: components["schemas"]["Id"][];
            title: string;
            /** @default null */
            year: number | null;
        };
        MangaDetail: components["schemas"]["MangaSummary"] & {
            alternativeTitles: {
                [key: string]: string[];
            };
            artists: {
                id: components["schemas"]["Id"];
                name: string;
                slug: components["schemas"]["Slug"];
            }[];
            availableLanguages: string[];
            chapterCounts: {
                releases: number;
                slots: number;
            };
            createdAt: components["schemas"]["Timestamp"];
            firstChapter: {
                id: components["schemas"]["Id"];
                number: string | null;
            } | null;
            groups: {
                /** Format: uri */
                avatarUrl: string | null;
                id: components["schemas"]["Id"];
                name: string;
                slug: components["schemas"]["Slug"];
            }[];
            lastChapter: string | null;
            lastVolume: string | null;
            links: {
                /** @enum {string} */
                key: "al" | "amz" | "ap" | "bw" | "cdj" | "ebj" | "engtl" | "kt" | "mal" | "mu" | "raw";
                label: string;
                /** Format: uri */
                url: string;
            }[];
            /** @enum {string} */
            numberingMode: "global" | "volume";
            publicationDemographic: string | null;
            publishedAt: components["schemas"]["Timestamp"];
            readingEntries: {
                first: components["schemas"]["ChapterNavigationChoice"];
                language: string;
                last: components["schemas"]["ChapterNavigationChoice"];
            }[];
            statistics: {
                comments: number;
                follows: number;
                views: number;
            };
            updatedAt: components["schemas"]["Timestamp"];
        };
        MangaList: {
            data: components["schemas"]["MangaListItem"][];
            meta: components["schemas"]["PageMeta"];
        };
        MangaListItem: components["schemas"]["MangaSummary"] & {
            alternativeTitles: {
                [key: string]: string[];
            };
            statistics: {
                comments: number;
                follows: number;
                views: number;
            };
        };
        MangaManagementDetail: components["schemas"]["MangaManagementSummary"] & {
            artistIds: components["schemas"]["Id"][];
            authorIds: components["schemas"]["Id"][];
            createdAt: components["schemas"]["Timestamp"];
            description: string | null;
            groups: {
                id: components["schemas"]["Id"];
                name: string;
                slug: components["schemas"]["Slug"];
            }[];
            lastChapter: string | null;
            lastVolume: string | null;
            links: {
                [key: string]: string;
            };
            ownerGroup: {
                id: components["schemas"]["Id"];
                name: string;
                slug: components["schemas"]["Slug"];
            };
            owners: {
                id: components["schemas"]["Id"];
                name: string;
                slug: components["schemas"]["Slug"];
            }[];
            /** @enum {string|null} */
            publicationDemographic: "shounen" | "shoujo" | "josei" | "seinen" | null;
            publishedAt: components["schemas"]["Timestamp"] & (string | null);
            tagIds: components["schemas"]["Id"][];
            volumes: {
                id: components["schemas"]["Id"];
                number: string;
            }[];
            year: number | null;
        };
        MangaManagementSummary: {
            alternativeTitles: {
                [key: string]: string[];
            };
            /** @enum {string} */
            contentRating: "safe" | "suggestive" | "erotica" | "pornographic";
            cover: components["schemas"]["Cover"];
            id: components["schemas"]["Id"];
            isOwner: boolean;
            moderationHiddenAt: components["schemas"]["Timestamp"] & (string | null);
            moderationReason: string | null;
            /** @enum {string} */
            numberingMode: "global" | "volume";
            originalLanguage: string;
            ownerGroupId: components["schemas"]["Id"];
            /** @enum {string} */
            publicationState: "published" | "hidden";
            slug: components["schemas"]["Slug"];
            /** @enum {string} */
            status: "ongoing" | "completed" | "hiatus" | "cancelled";
            title: string;
            updatedAt: components["schemas"]["Timestamp"];
            version: number;
        };
        MangaNewChapterNotification: {
            chapter: {
                id: components["schemas"]["Id"];
                number: string | null;
                title: string | null;
                volume: string | null;
            };
            createdAt: components["schemas"]["Timestamp"];
            id: components["schemas"]["Id"];
            manga: {
                id: components["schemas"]["Id"];
                slug: components["schemas"]["Slug"];
                title: string;
            };
            readAt: components["schemas"]["Timestamp"] & (string | null);
            /** @enum {string} */
            type: "manga_new_chapter";
        };
        MangaRanking: {
            data: {
                comments: number;
                follows: number;
                manga: components["schemas"]["MangaSummary"];
                rank: number;
                score: number | null;
                views: number;
            }[];
            meta: {
                activeSignals: {
                    comments: boolean;
                    follows: boolean;
                    views: boolean;
                };
                bucketDate: string;
                /** Format: date-time */
                calculatedAt: string;
                insufficientData: boolean;
                limit: number;
                /** @enum {string} */
                metric: "score" | "views" | "follows" | "comments";
                /** @enum {string} */
                window: "day" | "week" | "month" | "all-time";
            };
        };
        MangaReadingEntry: {
            data: components["schemas"]["ChapterSummary"][];
        };
        MangaReadingHistoryItem: {
            chapters: components["schemas"]["ReadingHistoryChapter"][];
            manga: {
                cover: components["schemas"]["Cover"];
                id: components["schemas"]["Id"];
                slug: components["schemas"]["Slug"];
                title: string;
            };
        };
        MangaRecommendations: {
            byAuthor: components["schemas"]["MangaSummary"][];
            similar: components["schemas"]["MangaSummary"][];
        };
        MangaSummary: {
            authors: components["schemas"]["PersonSummary"][];
            contentRating: string | null;
            cover: components["schemas"]["Cover"];
            description: string | null;
            id: components["schemas"]["Id"];
            latestChapter: {
                groups: {
                    id: components["schemas"]["Id"];
                    name: string;
                    slug: components["schemas"]["Slug"];
                }[];
                id: components["schemas"]["Id"];
                number: string | null;
                publishedAt: components["schemas"]["Timestamp"];
                statistics: {
                    comments: number;
                    views: number;
                };
            } | null;
            latestChapterPublishedAt: components["schemas"]["Timestamp"] | null;
            originalLanguage: string;
            slug: components["schemas"]["Slug"];
            status: string | null;
            tags: components["schemas"]["TagSummary"][];
            title: string;
            year: number | null;
        };
        MangaUpdateInput: {
            /** @default [] */
            alternativeTitles: string[];
            /** @default [] */
            artistIds: components["schemas"]["Id"][];
            /** @default [] */
            authorIds: components["schemas"]["Id"][];
            /** @enum {string} */
            contentRating: "safe" | "suggestive" | "erotica";
            /** @default null */
            description: string | null;
            expectedVersion: number;
            /** @default null */
            lastChapter: string | null;
            /** @default null */
            lastVolume: string | null;
            /** @default {} */
            links: {
                /** Format: uri */
                al?: string;
                /** Format: uri */
                amz?: string;
                /** Format: uri */
                ap?: string;
                /** Format: uri */
                bw?: string;
                /** Format: uri */
                cdj?: string;
                /** Format: uri */
                ebj?: string;
                /** Format: uri */
                engtl?: string;
                /** Format: uri */
                kt?: string;
                /** Format: uri */
                mal?: string;
                /** Format: uri */
                mu?: string;
                /** Format: uri */
                raw?: string;
            };
            originalLanguage: string;
            /**
             * @default null
             * @enum {string|null}
             */
            publicationDemographic: "shounen" | "shoujo" | "josei" | "seinen" | null;
            slug: components["schemas"]["Slug"];
            /** @enum {string} */
            status: "ongoing" | "completed" | "hiatus" | "cancelled";
            /** @default [] */
            tagIds: components["schemas"]["Id"][];
            title: string;
            /** @default null */
            year: number | null;
        };
        MergeHistoryInput: {
            entries: {
                /** Format: uuid */
                chapterId: string;
                readAt?: components["schemas"]["Timestamp"];
            }[];
        };
        MergeHistoryResult: {
            ignored: {
                acknowledged: boolean;
                chapterId: components["schemas"]["Id"];
                /** @enum {string} */
                reason: "stale" | "legacy_existing" | "not_found" | "future_read_at";
            }[];
            merged: components["schemas"]["ReadingProgress"][];
        };
        MyGroup: {
            data: {
                group: components["schemas"]["GroupManagement"];
                membership: components["schemas"]["GroupMembership"];
            } | null;
            isAdmin: boolean;
        };
        OwnProfile: {
            bio: string | null;
            createdAt: components["schemas"]["Timestamp"];
            isPublic: boolean;
            /** @enum {string} */
            status: "active" | "suspended" | "banned";
            updatedAt: components["schemas"]["Timestamp"];
        };
        PageMeta: {
            limit: number;
            page: number;
            total: number;
            totalPages: number;
        };
        PageQuery: {
            /**
             * @default 20
             * @example 20
             */
            limit: number;
            /**
             * @default 1
             * @example 1
             */
            page: number;
        };
        PersonalShopAvatarFrame: components["schemas"]["ShopAvatarFrame"] & {
            canPurchase: boolean;
            owned: boolean;
            /** @enum {string|null} */
            purchaseBlockReason: "shop_disabled" | "coin_disabled" | "avatar_frames_disabled" | "already_owned" | "sold_out" | "insufficient_coin" | null;
        };
        PersonalShopChest: components["schemas"]["ShopChestDetail"] & {
            balance: string;
            canRoll: boolean;
            pity: {
                rollCount: string;
                sinceSr: number;
                sinceSsr: number;
            };
            /** @enum {string|null} */
            rollBlockReason: "shop_disabled" | "coin_disabled" | "avatar_frames_disabled" | "gacha_disabled" | "chest_closed" | "pool_unavailable" | "sequence_limit" | "insufficient_coin" | null;
        };
        PersonCreateInput: {
            name: string;
        };
        PersonDetail: {
            description: string | null;
            id: components["schemas"]["Id"];
            links: {
                /** @enum {string} */
                key: "website" | "twitter" | "pixiv" | "fanbox" | "fantia" | "skeb" | "youtube";
                label: string;
                /** Format: uri */
                url: string;
            }[];
            name: string;
            roles: ("author" | "artist")[];
            slug: components["schemas"]["Slug"];
        };
        PersonList: {
            data: components["schemas"]["PersonSummary"][];
        };
        PersonSummary: {
            id: components["schemas"]["Id"];
            name: string;
            slug: components["schemas"]["Slug"];
        };
        ProgressInput: {
            readAt?: components["schemas"]["Timestamp"];
        };
        PublicProfile: {
            avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
            bio: string | null;
            commentCount: number;
            createdAt: components["schemas"]["Timestamp"];
            groups: {
                id: components["schemas"]["Id"];
                isLeader: boolean;
                name: string;
                slug: components["schemas"]["Slug"];
            }[];
            image: string | null;
            name: string;
            recentComments: {
                body: string;
                chapter: {
                    id: components["schemas"]["Id"];
                    number: string | null;
                    title: string | null;
                } | null;
                createdAt: components["schemas"]["Timestamp"];
                id: components["schemas"]["Id"];
                manga: {
                    id: components["schemas"]["Id"];
                    slug: components["schemas"]["Slug"];
                    title: string;
                };
            }[];
            verified: boolean;
        };
        PutLibraryItem: {
            category: components["schemas"]["LibraryCategory"];
        };
        RandomManga: {
            data: components["schemas"]["MangaSummary"][];
        };
        Readiness: {
            dependencies: {
                /** @enum {string} */
                postgres: "up" | "down";
                /** @enum {string} */
                redis: "healthy" | "degraded" | "disabled";
            };
            /** @enum {string} */
            status: "ready" | "degraded" | "not_ready";
        };
        ReadingHistoryChapter: {
            chapter: {
                id: components["schemas"]["Id"];
                language: string;
                number: string | null;
                title: string | null;
                volume: string | null;
            };
            progress: components["schemas"]["ReadingProgress"];
        };
        ReadingHistoryItem: {
            chapter: {
                id: components["schemas"]["Id"];
                language: string;
                number: string | null;
                title: string | null;
                volume: string | null;
            };
            manga: {
                cover: components["schemas"]["Cover"];
                id: components["schemas"]["Id"];
                slug: components["schemas"]["Slug"];
                title: string;
            };
            progress: components["schemas"]["ReadingProgress"];
        };
        ReadingProgress: {
            chapterId: components["schemas"]["Id"];
            mangaId: components["schemas"]["Id"];
            readAt: components["schemas"]["Timestamp"];
            updatedAt: components["schemas"]["Timestamp"];
        };
        RecentComment: {
            author: {
                avatarFrame: components["schemas"]["AvatarFrameSummary"] | null;
                id: string;
                image: string | null;
                name: string;
            };
            body: string;
            chapter: {
                id: components["schemas"]["Id"];
                number: string | null;
                title: string | null;
            } | null;
            createdAt: components["schemas"]["Timestamp"];
            id: components["schemas"]["Id"];
            manga: {
                id: components["schemas"]["Id"];
                slug: string;
                title: string;
            };
        };
        RecentCommentList: {
            data: components["schemas"]["RecentComment"][];
        };
        ShopAvatarFrame: {
            /** @enum {string} */
            availability: "in_stock" | "sold_out";
            code: components["schemas"]["Slug"];
            description: string;
            frame: components["schemas"]["AvatarFrameSummary"];
            frameVersion: number;
            price: string;
            /** @enum {string} */
            rarity: "R" | "SR" | "SSR";
            stock: number;
            topic: {
                id: components["schemas"]["Id"];
                name: string;
            } | null;
        };
        ShopChest: {
            /** @enum {string|null} */
            blockReason: "retired" | "pool_unavailable" | null;
            id: components["schemas"]["Id"];
            /** @enum {string} */
            kind: "common" | "topic";
            name: string;
            pool: {
                digest: string;
                R: number;
                SR: number;
                SSR: number;
                total: number;
            };
            price: string;
            ready: boolean;
            retiredAt: components["schemas"]["Timestamp"] & (string | null);
            saleEnabled: boolean;
            topic: {
                id: components["schemas"]["Id"] & (string | null);
                name: string;
            } | null;
            version: number;
        };
        ShopChestCatalog: {
            data: components["schemas"]["ShopChest"][];
            meta: components["schemas"]["PageMeta"];
            rollEnabled: boolean;
            rule: components["schemas"]["GachaRule"];
        };
        ShopChestDetail: {
            data: components["schemas"]["ShopChest"];
            rollEnabled: boolean;
            rule: components["schemas"]["GachaRule"];
        };
        ShopChestPool: {
            data: {
                code: components["schemas"]["Slug"];
                frame: components["schemas"]["AvatarFrameSummary"];
                /** @enum {string} */
                rarity: "R" | "SR" | "SSR";
                topic: {
                    id: components["schemas"]["Id"];
                    name: string;
                } | null;
            }[];
            meta: components["schemas"]["PageMeta"];
            poolDigest: string;
        };
        ShopPurchaseHistory: {
            data: components["schemas"]["ShopPurchaseReceipt"][];
            meta: {
                limit: number;
                nextCursor: string | null;
            };
        };
        ShopPurchaseInput: {
            expectedFrameVersion: number;
            expectedPrice: string;
            frameId: components["schemas"]["Id"];
            operationId: components["schemas"]["Id"];
        };
        ShopPurchaseReceipt: {
            balanceAfter: string;
            createdAt: components["schemas"]["Timestamp"];
            frame: {
                code: components["schemas"]["Slug"];
                id: components["schemas"]["Id"];
                name: string;
                /** @enum {string} */
                rarity: "R" | "SR" | "SSR";
            };
            id: components["schemas"]["Id"];
            ledgerId: components["schemas"]["Id"];
            operationId: components["schemas"]["Id"];
            price: string;
            sequence: string;
            transactionGroup: components["schemas"]["Id"];
        };
        SitemapIndex: {
            data: {
                pages: number;
                resource: components["schemas"]["SitemapResource"];
            }[];
        };
        SitemapPage: {
            data: {
                lastModified: components["schemas"]["Timestamp"] | null;
                path: string;
            }[];
        };
        /** @enum {string} */
        SitemapResource: "manga" | "chapter" | "tag" | "group" | "author" | "artist";
        /** @example one-piece */
        Slug: string;
        /** @enum {string} */
        SortDirection: "asc" | "desc";
        SystemNotice: {
            content: string;
            createdAt: components["schemas"]["Timestamp"];
            id: components["schemas"]["Id"];
            title: string;
            updatedAt: components["schemas"]["Timestamp"];
        };
        SystemNoticeNotification: {
            createdAt: components["schemas"]["Timestamp"];
            id: components["schemas"]["Id"];
            notice: {
                id: components["schemas"]["Id"];
                title: string;
            };
            readAt: components["schemas"]["Timestamp"] & (string | null);
            /** @enum {string} */
            type: "system_notice";
        };
        TagList: {
            data: components["schemas"]["TagSummary"][];
        };
        TagSummary: {
            group: string;
            id: components["schemas"]["Id"];
            name: string;
            slug: components["schemas"]["Slug"];
        };
        /**
         * Format: date-time
         * @example 2026-08-29T00:00:00.000Z
         */
        Timestamp: string;
        TranslationGroupDetail: components["schemas"]["TranslationGroupSummary"] & {
            /** Format: uri */
            bannerUrl: string | null;
            createdAt: components["schemas"]["Timestamp"];
            description: string | null;
            leader: string | null;
            links: {
                /** @enum {string} */
                key: "website" | "discord" | "twitter" | "facebook";
                label: string;
                /** Format: uri */
                url: string;
            }[];
            statistics: {
                chapterCount: number;
                mangaCount: number;
                releaseCount: number;
                views: number;
            };
        };
        TranslationGroupList: {
            data: components["schemas"]["TranslationGroupSummary"][];
            meta: components["schemas"]["PageMeta"];
        };
        TranslationGroupSummary: {
            /** Format: uri */
            avatarUrl: string | null;
            id: components["schemas"]["Id"];
            inactive: boolean;
            name: string;
            slug: components["schemas"]["Slug"];
        };
        UpdateProfile: {
            bio?: string | null;
            isPublic?: boolean;
        };
        UpdateShopChestInput: {
            expectedVersion: number;
            saleEnabled: boolean;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
