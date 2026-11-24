// What the identity provider and the limits learn of a request: its IP and its browser.
export type RequestOrigin = { ipAddress: string; userAgent?: string | undefined }
