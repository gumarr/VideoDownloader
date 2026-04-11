interface VideoInfoProps {
  title: string;
  thumbnail: string;
  duration: string;
}

export default function VideoInfo({ title, thumbnail, duration }: VideoInfoProps) {
  return (
    <div className="animate-fade-in-up rounded-2xl overflow-hidden
                    bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700
                    shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <div className="relative sm:w-72 w-full aspect-video sm:aspect-auto flex-shrink-0 overflow-hidden group">
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Duration badge */}
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-xs font-semibold
                           bg-black/80 text-white backdrop-blur-sm">
            {duration}
          </span>
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors duration-300">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center 
                            opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
                            transition-all duration-300 shadow-lg">
              <svg className="w-5 h-5 text-surface-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
        {/* Info */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center min-w-0">
          <h2 className="text-base font-semibold text-surface-900 dark:text-surface-50 leading-snug line-clamp-2 mb-2">
            {title}
          </h2>
          <div className="flex items-center gap-3 text-sm text-surface-500 dark:text-surface-400">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {duration}
            </span>
            <span className="w-1 h-1 rounded-full bg-surface-400" />
            <span>YouTube</span>
          </div>
        </div>
      </div>
    </div>
  );
}
