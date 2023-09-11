/** @format */

import { useQuery } from "@tanstack/react-query";
import { CardScroller } from "../../cardScroller/cardScroller";
import { Card } from "../../card/card";
import { CardsSkeleton } from "../../skeleton/cards";

import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import { getUserLibraryApi } from "@jellyfin/sdk/lib/utils/api/user-library-api";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client";

export const LatestMediaSection = ({ latestMediaLib }) => {
	const user = useQuery({
		queryKey: ["user"],
		queryFn: async () => {
			let usr = await getUserApi(window.api).getCurrentUser();
			return usr.data;
		},
		networkMode: "always",
	});
	const fetchLatestMedia = async (library) => {
		const media = await getUserLibraryApi(window.api).getLatestMedia({
			userId: user.data.Id,
			parentId: library,
			limit: 16,
			fields: ["PrimaryImageAspectRatio"],
		});
		return media.data;
	};
	const data = useQuery({
		queryKey: ["homeSection, latestMedia", latestMediaLib],
		queryFn: () => fetchLatestMedia(latestMediaLib[0]),
		enabled: !!user.data,
		networkMode: "always",
	});
	if (data.isLoading) {
		return <CardsSkeleton />;
	}
	if (data.isSuccess && data.data.length >= 1) {
		return (
			<CardScroller
				displayCards={8}
				title={"Latest " + latestMediaLib[1]}
			>
				{data.data.map((item, index) => {
					return (
						<Card
							key={item.Id}
							item={item}
							seriesId={item.SeriesId}
							cardTitle={
								item.Type == BaseItemKind.Episode
									? item.SeriesName
									: item.Name
							}
							imageType={"Primary"}
							cardCaption={
								item.Type == BaseItemKind.Episode
									? `S${item.ParentIndexNumber}:E${item.IndexNumber} - ${item.Name}`
									: item.Type == BaseItemKind.Series
									? `${item.ProductionYear} - ${
											!!item.EndDate
												? new Date(
														item.EndDate,
												  ).toLocaleString(
														[],
														{
															year: "numeric",
														},
												  )
												: "Present"
									  }`
									: item.ProductionYear
							}
							cardType={
								item.Type == BaseItemKind.MusicAlbum ||
								item.Type == BaseItemKind.Audio
									? "square"
									: "portrait"
							}
							queryKey={[
								"homeSection, latestMedia",
								latestMediaLib,
							]}
							userId={user.data.Id}
							imageBlurhash={
								item.ImageBlurHashes?.Primary[
									Object.keys(
										item.ImageBlurHashes.Primary,
									)[0]
								]
							}
						></Card>
					);
				})}
			</CardScroller>
		);
	}

	return <></>;
};