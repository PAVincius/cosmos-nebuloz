export type WSJFLabels = {
  bv: string;
  tc: string;
  rr: string;
  js: string;
};

export type WSJFConfig = {
  scale: number[];
  labels: WSJFLabels;
};

export type FeatureWSJF = {
  id: string;
  title: string;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  wsjfScore: number;
  statusId: string;
  externalSource: string | null;
  externalUrl: string | null;
};

export type EpicWithFeatures = {
  id: string;
  title: string;
  statusId: string;
  features: FeatureWSJF[];
  totalWSJF: number;
  dependencyCount: number;
  themeTitle: string | null;
  themeColor: string | null;
};
