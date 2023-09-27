/** @format */
import { useState, useEffect } from "react";
import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import { IconButton, useTheme } from "@mui/material";

import { useParams, useNavigate } from "react-router-dom";

import {
	BaseItemKind,
	ItemFields,
	SortOrder,
} from "@jellyfin/sdk/lib/generated-client";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import { getUserLibraryApi } from "@jellyfin/sdk/lib/utils/api/user-library-api";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api";
import { getPlaylistsApi } from "@jellyfin/sdk/lib/utils/api/playlists-api";

import { useQuery } from "@tanstack/react-query";
import { MdiClockOutline } from "../../components/icons/mdiClockOutline";

import { getRuntimeMusic, getRuntimeFull, endsAt } from "../../utils/date/time";

import Hero from "../../components/layouts/item/hero";
import { Card } from "../../components/card/card";
import { CardScroller } from "../../components/cardScroller/cardScroller";

import "./playlist.module.scss";
import { ErrorNotice } from "../../components/notices/errorNotice/errorNotice";
import { useBackdropStore } from "../../utils/store/backdrop";
import LikeButton from "../../components/buttons/likeButton";
import { MdiPlayOutline } from "../../components/icons/mdiPlayOutline";
import { useAudioPlayback } from "../../utils/store/audioPlayback";
import MusicTrack from "../../components/musicTrack";
function TabPanel(props) {
	const { children, value, index, ...other } = props;

	return (
		<div
			role="tabpanel"
			hidden={value !== index}
			id={`full-width-tabpanel-${index}`}
			aria-labelledby={`full-width-tab-${index}`}
			{...other}
			style={{ marginTop: "1em" }}
		>
			{value === index && <Box>{children}</Box>}
		</div>
	);
}

TabPanel.propTypes = {
	children: PropTypes.node,
	index: PropTypes.number.isRequired,
	value: PropTypes.number.isRequired,
};

function a11yProps(index) {
	return {
		id: `full-width-tab-${index}`,
		"aria-controls": `full-width-tabpanel-${index}`,
	};
}

const PlaylistTitlePage = () => {
	const { id } = useParams();

	const user = useQuery({
		queryKey: ["user"],
		queryFn: async () => {
			let usr = await getUserApi(window.api).getCurrentUser();
			return usr.data;
		},
		networkMode: "always",
	});

	const item = useQuery({
		queryKey: ["item", id],
		queryFn: async () => {
			const result = await getUserLibraryApi(window.api).getItem({
				userId: user.data.Id,
				itemId: id,
				fields: [ItemFields.Crew],
			});
			return result.data;
		},
		enabled: !!user.data,
		networkMode: "always",
		refetchOnWindowFocus: true,
	});

	const similarItems = useQuery({
		queryKey: ["item", id, "similarItem"],
		queryFn: async () => {
			let result = await getLibraryApi(window.api).getSimilarAlbums({
				userId: user.data.Id,
				itemId: item.data.Id,
				limit: 16,
			});
			return result.data;
		},
		enabled: item.isSuccess,
		networkMode: "always",
		refetchOnWindowFocus: true,
	});

	const musicTracks = useQuery({
		queryKey: ["item", id, "musicTracks"],
		queryFn: async () => {
			const result = await getPlaylistsApi(
				window.api,
			).getPlaylistItems({
				userId: user.data.Id,
				playlistId: item.data.Id,
			});
			return result.data;
		},
		enabled: item.isSuccess,
		networkMode: "always",
	});

	const [setAppBackdrop] = useBackdropStore((state) => [state.setBackdrop]);

	useEffect(() => {
		if (item.isSuccess) {
			setAppBackdrop(
				item.data.Type === BaseItemKind.MusicAlbum ||
					item.data.Type === BaseItemKind.Episode
					? `${window.api.basePath}/Items/${item.data.ParentBackdropItemId}/Images/Backdrop`
					: `${window.api.basePath}/Items/${item.data.Id}/Images/Backdrop`,
				item.data.Id,
			);
		}
	}, [item.isSuccess]);

	if (item.isLoading || similarItems.isLoading) {
		return (
			<Box
				sx={{
					width: "100%",
					height: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<CircularProgress />
			</Box>
		);
	}
	if (item.isSuccess && similarItems.isSuccess) {
		return (
			<div
				className="scrollY"
				style={{
					padding: "5em 2em 2em 1em",
					display: "flex",
					flexDirection: "column",
					gap: "0.5em",
				}}
			>
				<Hero
					item={item.data}
					userId={user.data.Id}
					queryKey={["item", id]}
					artists={item.data.ArtistItems}
					disableMarkAsPlayedButton
					audioPlayButton
					cardType="square"
				/>
				{musicTracks.isLoading ? (
					<></>
				) : (
					musicTracks.data.TotalRecordCount > 0 &&
					musicTracks.data.Items.map((track, index) => {
						return (
							<MusicTrack
								item={track}
								key={track.Id}
								queryKey={["item", id, "musicTracks"]}
								userId={user.data.Id}
								playlistItem
								playlistItemId={item.data.Id}
							/>
						);
					})
				)}

				{similarItems.data.TotalRecordCount > 0 && (
					<CardScroller
						title="You might also like"
						displayCards={8}
						disableDecoration
					>
						{similarItems.data.Items.map((similar, index) => {
							return (
								<Card
									key={similar.Id}
									item={similar}
									seriesId={similar.SeriesId}
									cardTitle={
										similar.Type ==
										BaseItemKind.Episode
											? similar.SeriesName
											: similar.Name
									}
									imageType={"Primary"}
									cardCaption={
										similar.Type ==
										BaseItemKind.Episode
											? `S${similar.ParentIndexNumber}:E${similar.IndexNumber} - ${similar.Name}`
											: similar.Type ==
											  BaseItemKind.Series
											? `${
													similar.ProductionYear
											  } - ${
													!!similar.EndDate
														? new Date(
																similar.EndDate,
														  ).toLocaleString(
																[],
																{
																	year: "numeric",
																},
														  )
														: "Present"
											  }`
											: similar.ProductionYear
									}
									cardType={
										similar.Type ==
											BaseItemKind.MusicAlbum ||
										similar.Type ==
											BaseItemKind.Audio
											? "square"
											: "portrait"
									}
									queryKey={[
										"item",
										id,
										"similarItem",
									]}
									userId={user.data.Id}
									imageBlurhash={
										!!similar.ImageBlurHashes
											?.Primary &&
										similar.ImageBlurHashes
											?.Primary[
											Object.keys(
												similar
													.ImageBlurHashes
													.Primary,
											)[0]
										]
									}
								/>
							);
						})}
					</CardScroller>
				)}
			</div>
		);
	}
	if (item.isError || similarItems.isError) {
		return <ErrorNotice />;
	}
};

export default PlaylistTitlePage;