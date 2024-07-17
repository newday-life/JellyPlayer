import type {
	BaseItemDto,
	BaseItemKind,
	MediaProtocol,
	MediaStream,
} from "@jellyfin/sdk/lib/generated-client";
import { getMediaInfoApi } from "@jellyfin/sdk/lib/utils/api/media-info-api";
import { create } from "zustand";
import playbackProfile from "../playback-profiles";
import type subtitlePlaybackInfo from "../types/subtitlePlaybackInfo";
import { useApiInContext } from "./api";
import { playAudio } from "./audioPlayback";
import useQueue, { setQueue, setTrackIndex } from "./queue";

type PlaybackStore = {
	itemName: string | React.Component | undefined | null;
	episodeTitle: string | React.Component;
	mediaSource: {
		videoTrack: number;
		audioTrack: number;
		container: string;
		id: string | undefined;
		subtitle: subtitlePlaybackInfo;
	};
	playbackStream: string;
	userId: string;
	startPosition: number;
	itemDuration: number;
	item: BaseItemDto | null;
	playsessionId: string | undefined | null;
};

export const usePlaybackStore = create<PlaybackStore>(() => ({
	itemName: undefined!,
	episodeTitle: "",
	mediaSource: {
		videoTrack: 0,
		audioTrack: 0,
		container: "",
		id: undefined,
		subtitle: {
			enable: false,
			track: undefined!,
			format: "ass",
			allTracks: undefined,
			url: undefined,
		},
	},
	enableSubtitle: true,
	playbackStream: "",
	userId: "",
	startPosition: 0,
	itemDuration: 0,
	item: null,
	playsessionId: "",
}));

export const playItem = (
	itemName: string | React.Component | undefined | null,
	episodeTitle: string,
	videoTrack: number,
	audioTrack: number,
	container: string,
	playbackStream: string,
	userId: string,
	startPosition: number | undefined | null,
	itemDuration: number | undefined | null,
	item: BaseItemDto,
	queue: BaseItemDto[] | undefined | null,
	queueItemIndex: number,
	mediaSourceId: string | undefined | null,
	playsessionId: string | undefined | null,
	subtitle: subtitlePlaybackInfo,
) => {
	console.log({
		itemName,
		episodeTitle,
		mediaSource: {
			videoTrack,
			audioTrack,
			container,
			id: mediaSourceId,
			subtitle,
		},
		playbackStream,
		userId,
		startPosition,
		itemDuration,
		item,
		playsessionId,
	});
	usePlaybackStore.setState({
		itemName,
		episodeTitle,
		mediaSource: {
			videoTrack,
			audioTrack,
			container,
			id: mediaSourceId,
			subtitle,
		},
		playbackStream,
		userId,
		startPosition,
		itemDuration,
		item,
		playsessionId,
	});
	setQueue(queue, queueItemIndex);
};

export const playItemFromQueue = async (
	index: "next" | "previous" | number,
	userId: string | undefined,
) => {
	const queueItems = useQueue.getState().tracks;
	const currentItemIndex = useQueue.getState().currentItemIndex;
	const requestedItemIndex =
		index === "next"
			? currentItemIndex + 1
			: index === "previous"
				? currentItemIndex - 1
				: index;
	const item = queueItems[requestedItemIndex];
	const api = useApiInContext((s) => s.api);
	if (item.Type === "Audio") {
		const urlOptions = {
			deviceId: api?.deviceInfo.id,
			userId,
			api_key: api?.accessToken,
		};
		const urlParams = new URLSearchParams(urlOptions).toString();

		const playbackUrl = `${api.basePath}/Audio/${item?.Id}/universal?${urlParams}`;
		console.log(item);
		playAudio(playbackUrl, item, undefined, queueItems, requestedItemIndex);
	} else {
		const mediaInfo = await getMediaInfoApi(api).getPostedPlaybackInfo({
			audioStreamIndex: item.MediaSources[0].DefaultAudioStreamIndex ?? 0,
			subtitleStreamIndex: item.MediaSources[0].DefaultSubtitleStreamIndex ?? 0,
			itemId: item.Id,
			startTimeTicks: item.UserData?.PlaybackPositionTicks,
			userId: userId,
			mediaSourceId: item.MediaSources[0].Id,
			playbackInfoDto: {
				DeviceProfile: playbackProfile,
			},
		});
		console.log(mediaInfo);
		let itemName = item.Name;
		let episodeTitle = "";
		if (item.SeriesId) {
			itemName = item.SeriesName;
			episodeTitle = `S${item.ParentIndexNumber ?? 0}:E${
				item.IndexNumber ?? 0
			} ${item.Name}`;
		}

		// Select correct subtitle track, this is useful if item is played with playbutton from card since that does not provide coorect default subtitle track index.
		let selectedSubtitleTrack: number | "nosub" | undefined = -1;
		const subtitles = mediaInfo.data.MediaSources[0].MediaStreams?.filter(
			(value) => value.Type === "Subtitle",
		);
		let enableSubtitles = true;
		if (mediaInfo.data.MediaSources[0].DefaultSubtitleStreamIndex) {
			selectedSubtitleTrack =
				mediaInfo.data.MediaSources[0].DefaultSubtitleStreamIndex;
		} else if (subtitles?.length > 0) {
			selectedSubtitleTrack = subtitles[0].Index;
		} else {
			enableSubtitles = false;
		}
		const videoTrack = mediaInfo.data.MediaSources[0].MediaStreams?.filter(
			(value) => value.Type === "Subtitle",
		);

		const urlOptions = {
			Static: true,
			tag: mediaInfo.data.MediaSources[0].ETag,
			mediaSourceId: mediaInfo.data.MediaSources[0].Id,
			deviceId: api?.deviceInfo.id,
			api_key: api?.accessToken,
			startTimeTicks: item.UserData?.PlaybackPositionTicks,
		};

		const urlParams = new URLSearchParams(urlOptions).toString();
		let playbackUrl = `${api?.basePath}/Videos/${mediaInfo.data.MediaSources[0].Id}/stream.${mediaInfo.data.MediaSources[0].Container}?${urlParams}`;

		if (
			mediaInfo.data.MediaSources[0].SupportsTranscoding &&
			mediaInfo.data.MediaSources[0].TranscodingUrl
		) {
			playbackUrl = `${api.basePath}${mediaInfo.data.MediaSources[0].TranscodingUrl}`;
		} else if (mediaInfo.data.MediaSources[0].hlsStream) {
			playbackUrl = mediaInfo.data.MediaSources[0].hlsStream;
		}
		playItem(
			itemName,
			episodeTitle,
			videoTrack[0].Index,
			mediaInfo.data.MediaSources[0].DefaultAudioStreamIndex ?? 0,
			selectedSubtitleTrack,
			mediaInfo.data?.MediaSources[0].Container ?? "mkv",
			enableSubtitles,
			playbackUrl,
			userId,
			item.UserData?.PlaybackPositionTicks,
			item.RunTimeTicks,
			item,
			queueItems,
			requestedItemIndex,
			subtitles,
			mediaInfo.data.MediaSources[0].Id,
			mediaInfo.data.PlaySessionId,
		);
	}

	return "playing"; // Return any value to end mutation pending status
};

interface PlaybackDataLoadState {
	isPending: boolean;
	setisPending: (loading: boolean) => void;
}

export const usePlaybackDataLoadStore = create<PlaybackDataLoadState>(
	(set) => ({
		isPending: false,
		setisPending: (loading: boolean) =>
			set((state: PlaybackDataLoadState) => ({
				...state,
				isPending: loading,
			})),
	}),
);

export const changeSubtitleTrack = (
	trackIndex: number,
	allTracks: MediaStream[],
) => {
	const requiredSubtitle = allTracks.filter(
		(track) => track.Index === trackIndex,
	);
	const prevState = usePlaybackStore.getState();
	prevState.mediaSource.subtitle = {
		url: requiredSubtitle?.[0]?.DeliveryUrl,
		track: trackIndex,
		format: requiredSubtitle?.[0]?.Codec,
		allTracks,
		enable: true,
	};
	usePlaybackStore.setState(prevState);
};