export interface ExplorerFile {
  path: string;
  label: string;
  type: "file";
  mimeType: string;
}

export interface ExplorerDirectory {
  path: string;
  label: string;
  type: "directory";
  nodes: ExplorerNode[];
}

export interface ExplorerDictionary  {
  path: string;
  label: string;
  type: "directory";
  nodes: Record<string, ExplorerNodeDict>;
}

export type ExplorerNode = ExplorerFile | ExplorerDirectory;
export type ExplorerNodeDict = ExplorerFile | ExplorerDictionary;
