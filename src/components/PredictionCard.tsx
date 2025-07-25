import { Heart, MessageCircle, Share, Star, MoreVertical, Play, VolumeX, Volume2, Pause, Maximize, Minimize } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import PredictionModal from './PredictionModal';
import CommentsBottomSheet from './CommentsBottomSheet';
import ProtectedComponent from './ProtectedComponent';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useOptimizedPosts } from '@/hooks/useOptimizedPosts';
import { usePostActions } from '@/hooks/usePostActions';

interface PredictionCardProps {
  prediction: {
    id: number;
    user: {
      username: string;
      avatar: string;
      badge: string;
      badgeColor: string;
    };
    match: string;
    prediction: string;
    odds: string;
    confidence: number;
    analysis: string;
    likes: number;
    comments: number;
    shares: number;
    successRate: number;
    timeAgo: string;
    sport: string;
    image?: string;
    video?: string;
    totalOdds?: string;
    matches?: Array<{
      id: number;
      teams: string;
      prediction: string;
      odds: string;
      league: string;
      time: string;
    }>;
    is_liked?: boolean;
  };
}

const PredictionCard = ({ prediction }: PredictionCardProps) => {
  const navigate = useNavigate();
  const { requireAuth, user } = useAuth();
  const { likePost } = useOptimizedPosts();
  const { 
    followUser, 
    savePost, 
    sharePost, 
    reportPost, 
    hidePost, 
    blockUser,
    checkIfUserFollowed,
    checkIfPostSaved,
    checkIfUserBlocked,
    loading: actionsLoading
  } = usePostActions();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiked, setIsLiked] = useState(prediction.is_liked || false);
  const [likesCount, setLikesCount] = useState(prediction.likes);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [actionStatesLoaded, setActionStatesLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const loadActionStates = async () => {
      if (user && !actionStatesLoaded) {
        console.log('Loading action states for user:', user.id, 'post:', prediction.id);
        try {
          const [followed, saved, blocked] = await Promise.all([
            checkIfUserFollowed(prediction.user.username),
            checkIfPostSaved(prediction.id.toString()),
            checkIfUserBlocked(prediction.user.username)
          ]);
          
          setIsFollowed(followed);
          setIsSaved(saved);
          setIsBlocked(blocked);
          setActionStatesLoaded(true);
          
          console.log('Action states loaded:', { followed, saved, blocked });
        } catch (error) {
          console.error('Error loading action states:', error);
        }
      }
    };

    loadActionStates();
  }, [user, prediction.id, prediction.user.username, checkIfUserFollowed, checkIfPostSaved, checkIfUserBlocked, actionStatesLoaded]);

  const handleMenuAction = async (action: string) => {
    if (!requireAuth()) return;
    
    console.log(`Executing action: ${action} for post ${prediction.id}`);
    
    try {
      switch (action) {
        case 'follow':
          await followUser(prediction.user.username);
          // Recharger l'état après l'action
          const newFollowState = await checkIfUserFollowed(prediction.user.username);
          setIsFollowed(newFollowState);
          break;
        case 'save':
          await savePost(prediction.id.toString());
          // Recharger l'état après l'action
          const newSaveState = await checkIfPostSaved(prediction.id.toString());
          setIsSaved(newSaveState);
          break;
        case 'report':
          await reportPost(prediction.id.toString(), 'inappropriate', 'Contenu inapproprié');
          break;
        case 'hide':
          await hidePost(prediction.id.toString());
          toast.info('Ce post a été masqué');
          break;
        case 'block':
          await blockUser(prediction.user.username);
          // Recharger l'état après l'action
          const newBlockState = await checkIfUserBlocked(prediction.user.username);
          setIsBlocked(newBlockState);
          break;
        default:
          console.log(`Action: ${action} on prediction ${prediction.id}`);
      }
    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
      toast.error('Une erreur est survenue lors de l\'opération');
    }
  };

  const handleProfileClick = () => {
    if (!requireAuth()) return;
    navigate('/profile');
  };

  const handleShare = async () => {
    if (!requireAuth()) return;
    
    const postUrl = `${window.location.origin}/post/${prediction.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pronostic de ${prediction.user.username}`,
          text: `${prediction.match} - ${prediction.prediction}`,
          url: postUrl,
        });
        // Enregistrer le partage en base
        await sharePost(prediction.id.toString(), 'social');
      } catch (error) {
        console.log('Partage annulé');
      }
    } else {
      try {
        await navigator.clipboard.writeText(postUrl);
        toast.success('Lien copié dans le presse-papier !');
        // Enregistrer le partage en base
        await sharePost(prediction.id.toString(), 'link');
      } catch (error) {
        toast.error('Impossible de copier le lien');
      }
    }
  };

  const handleLike = async () => {
    if (!requireAuth()) return;
    
    try {
      await likePost(prediction.id.toString());
      
      // La mise à jour locale est maintenant gérée dans useOptimizedPosts
      // mais on garde la logique locale pour une meilleure UX
      if (isLiked) {
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        setLikesCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
      showControlsTemporarily();
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen(!isFullscreen);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (videoRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / video.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      showControlsTemporarily();
    };

    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  if (isBlocked) {
    return null;
  }

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* User Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div 
              className="relative cursor-pointer"
              onClick={handleProfileClick}
            >
              <img
                src={prediction.user.avatar}
                alt={prediction.user.username}
                className="w-10 h-10 rounded-full"
              />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${prediction.user.badgeColor} rounded-full flex items-center justify-center`}>
                <span className="text-white text-xs font-bold">
                  {prediction.user.badge === 'Confirmé' ? 'C' : prediction.user.badge === 'Pro' ? 'P' : 'N'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span 
                  className="font-medium text-gray-900 cursor-pointer hover:underline"
                  onClick={handleProfileClick}
                >
                  {prediction.user.username}
                </span>
                <span className="text-xs text-gray-500">{prediction.timeAgo}</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>{prediction.successRate}% de réussite</span>
                <span>•</span>
                <span className="px-2 py-1 bg-gray-100 rounded-full">{prediction.sport}</span>
              </div>
            </div>
          </div>
          
          {/* Menu 3 points */}
          <ProtectedComponent fallback={
            <button className="p-1 hover:bg-gray-100 rounded-full transition-colors opacity-50 cursor-not-allowed">
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
          }>
            <Drawer>
              <DrawerTrigger asChild>
                <button 
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  disabled={actionsLoading}
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
              </DrawerTrigger>
              <DrawerContent className="h-[75vh] pb-8">
                <DrawerHeader>
                  <DrawerTitle>Options du post</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 space-y-3">
                  <button 
                    onClick={() => handleMenuAction('follow')}
                    disabled={actionsLoading}
                    className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
                  >
                    <span className="text-2xl">👤</span>
                    <span>{isFollowed ? 'Ne plus suivre' : 'Suivre'} cet utilisateur</span>
                  </button>
                  <button 
                    onClick={() => handleMenuAction('save')}
                    disabled={actionsLoading}
                    className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
                  >
                    <span className="text-2xl">🔖</span>
                    <span>{isSaved ? 'Retirer des sauvegardes' : 'Sauvegarder'}</span>
                  </button>
                  <button 
                    onClick={handleShare}
                    disabled={actionsLoading}
                    className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
                  >
                    <span className="text-2xl">📋</span>
                    <span>Partager</span>
                  </button>
                  <button 
                    onClick={() => handleMenuAction('report')}
                    disabled={actionsLoading}
                    className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
                  >
                    <span className="text-2xl">🚨</span>
                    <span>Signaler</span>
                  </button>
                  <button 
                    onClick={() => handleMenuAction('hide')}
                    disabled={actionsLoading}
                    className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
                  >
                    <span className="text-2xl">👁️</span>
                    <span>Masquer ce post</span>
                  </button>
                  <button 
                    onClick={() => handleMenuAction('block')}
                    disabled={actionsLoading}
                    className="w-full text-left p-3 hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-3 text-red-600 disabled:opacity-50"
                  >
                    <span className="text-2xl">🚫</span>
                    <span>Bloquer l'utilisateur</span>
                  </button>
                </div>
              </DrawerContent>
            </Drawer>
          </ProtectedComponent>
        </div>

        {/* Match Info */}
        <div className="mb-3">
          <div className="font-semibold text-lg text-gray-900 mb-2">{prediction.match}</div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Cote: {prediction.odds}</span>
              {prediction.totalOdds && (
                <span className="text-sm text-orange-600 font-medium">
                  Cote totale: {prediction.totalOdds}
                </span>
              )}
            </div>
            <ProtectedComponent fallback={
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs opacity-50 cursor-not-allowed">
                Se connecter
              </Button>
            }>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={() => handleMenuAction('follow')}
                disabled={actionsLoading}
              >
                {isFollowed ? 'Suivi' : 'Suivre'}
              </Button>
            </ProtectedComponent>
          </div>
          
          {/* Confidence Stars */}
          <div className="flex items-center space-x-1">
            <span className="text-sm text-gray-600">Confiance:</span>
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < prediction.confidence ? 'text-yellow-400 fill-current' : 'text-gray-300'
                }`}
              />
            ))}
            <span className="text-sm text-yellow-600 font-medium ml-1">
              {prediction.confidence === 5 ? '🔥🔥' : prediction.confidence >= 4 ? '🔥' : ''}
            </span>
          </div>
        </div>

        {/* Media Content */}
        {(prediction.image || prediction.video) && (
          <div className="mb-4 rounded-lg overflow-hidden relative">
            {prediction.video ? (
              <div 
                className={`relative cursor-pointer ${isFullscreen ? 'fixed inset-0 z-50 bg-black flex items-center justify-center' : ''}`}
                onClick={handleVideoClick}
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => {
                  if (isPlaying) {
                    showControlsTemporarily();
                  }
                }}
              >
                <video
                  ref={videoRef}
                  className={`object-cover ${isFullscreen ? 'max-w-full max-h-full' : 'w-full h-48'}`}
                  poster="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop"
                  muted={isMuted}
                  playsInline
                  preload="metadata"
                  controls={false}
                >
                  <source src={prediction.video} type="video/mp4" />
                </video>
                
                {/* Contrôles vidéo */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${
                  showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
                }`}>
                  {/* Bouton Play/Pause central */}
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                        <Play className="w-8 h-8 text-gray-800 ml-1" />
                      </div>
                    </div>
                  )}
                  
                  {/* Contrôles en bas */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    {/* Barre de progression */}
                    <div 
                      className="w-full h-1 bg-white/30 rounded-full mb-2 cursor-pointer"
                      onClick={handleProgressClick}
                    >
                      <div 
                        className="h-full bg-white rounded-full transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    
                    {/* Boutons de contrôle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={toggleMute}
                          className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
                        >
                          {isMuted ? (
                            <VolumeX className="w-4 h-4 text-white" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <span className="text-white text-xs">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>
                      
                      <button 
                        onClick={toggleFullscreen}
                        className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        {isFullscreen ? (
                          <Minimize className="w-4 h-4 text-white" />
                        ) : (
                          <Maximize className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : prediction.image && (
              <img
                src={prediction.image}
                alt="Contenu du post"
                className="w-full h-48 object-cover"
              />
            )}
          </div>
        )}

        {/* Analysis */}
        <div className="mb-4">
          <p className="text-gray-700 text-sm leading-relaxed">{prediction.analysis}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <ProtectedComponent fallback={
              <button className="flex items-center space-x-1 text-gray-400 cursor-not-allowed">
                <Heart className="w-5 h-5" />
                <span className="text-sm">{likesCount}</span>
              </button>
            }>
              <button 
                onClick={handleLike}
                className={`flex items-center space-x-1 transition-colors ${
                  isLiked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-sm">{likesCount}</span>
              </button>
            </ProtectedComponent>
            
            <ProtectedComponent fallback={
              <button className="flex items-center space-x-1 text-gray-400 cursor-not-allowed">
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">{prediction.comments}</span>
              </button>
            }>
              <CommentsBottomSheet postId={prediction.id.toString()} commentsCount={prediction.comments}>
                <button className="flex items-center space-x-1 text-gray-600 hover:text-blue-500 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm">{prediction.comments}</span>
                </button>
              </CommentsBottomSheet>
            </ProtectedComponent>
            
            <ProtectedComponent fallback={
              <button className="flex items-center space-x-1 text-gray-400 cursor-not-allowed">
                <Share className="w-5 h-5" />
                <span className="text-sm">{prediction.shares}</span>
              </button>
            }>
              <button 
                onClick={handleShare}
                className="flex items-center space-x-1 text-gray-600 hover:text-green-500 transition-colors"
              >
                <Share className="w-5 h-5" />
                <span className="text-sm">{prediction.shares}</span>
              </button>
            </ProtectedComponent>
          </div>
          
          <ProtectedComponent fallback={
            <Button className="bg-gray-400 text-white text-xs px-2 py-1 h-7 cursor-not-allowed" size="sm" disabled>
              Se connecter
            </Button>
          }>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 h-7" size="sm">
                  Voir pronos
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Pronostics de {prediction.user.username}</DialogTitle>
                </DialogHeader>
                <PredictionModal prediction={prediction} />
              </DialogContent>
            </Dialog>
          </ProtectedComponent>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictionCard;
