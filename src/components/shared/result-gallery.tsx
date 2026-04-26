import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type GalleryAsset = {
  id: string;
  url: string;
  mimeType: string;
  prompt?: string;
  provider?: string;
  model?: string;
};

function isVideo(mimeType: string) {
  return mimeType.startsWith("video/");
}

function providerLabel(provider?: string) {
  if (!provider) {
    return null;
  }

  if (provider.toLowerCase() === "replicate") {
    return "Replicate";
  }

  if (provider.toLowerCase() === "openai") {
    return "OpenAI";
  }

  return provider;
}

export function ResultGallery({
  assets,
  title = "결과",
}: {
  assets: GalleryAsset[];
  title?: string;
}) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} <span className="ml-2 text-sm text-zinc-500">({assets.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <article
              key={asset.id}
              className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
            >
              <div className="relative aspect-square bg-zinc-900">
                {isVideo(asset.mimeType) ? (
                  <video
                    controls
                    className="h-full w-full object-cover"
                    src={asset.url}
                  />
                ) : (
                  <Image
                    alt={asset.prompt ?? "생성된 결과"}
                    className="h-full w-full object-cover"
                    fill
                    src={asset.url}
                    unoptimized
                  />
                )}
              </div>
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {asset.provider ? <Badge>{providerLabel(asset.provider)}</Badge> : null}
                  {asset.model ? (
                    <span className="break-all text-xs text-zinc-500">{asset.model}</span>
                  ) : null}
                </div>
                {asset.prompt ? (
                  <p className="line-clamp-2 text-xs text-zinc-400">{asset.prompt}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
