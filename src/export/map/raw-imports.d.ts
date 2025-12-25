// Type declarations for Vite's ?raw imports
declare module '*.css?raw' {
  const content: string
  export default content
}

declare module '*.js?raw' {
  const content: string
  export default content
}

declare module '*.html?raw' {
  const content: string
  export default content
}
