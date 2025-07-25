
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  parent_id?: string;
  likes_count: number;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  badge?: string;
  replies?: Comment[];
  is_liked?: boolean;
}

export const useComments = (postId: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const channelRef = useRef<any>(null);

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    
    setLoading(true);
    try {
      // Récupérer les commentaires avec les informations de profil
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles!comments_user_id_fkey (
            username,
            display_name,
            avatar_url,
            badge
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }

      // Récupérer les likes de l'utilisateur actuel
      let userLikes: string[] = [];
      if (user) {
        const { data: likesData } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id);
        
        userLikes = likesData?.map(like => like.comment_id) || [];
      }

      // Transformer les données des commentaires
      const transformedComments = commentsData?.map((comment: any) => ({
        ...comment,
        username: comment.profiles?.username,
        display_name: comment.profiles?.display_name,
        avatar_url: comment.profiles?.avatar_url,
        badge: comment.profiles?.badge,
        is_liked: userLikes.includes(comment.id),
      })) || [];

      // Organiser les commentaires avec leurs réponses
      const rootComments = transformedComments.filter((comment: Comment) => !comment.parent_id);
      const commentsWithReplies = rootComments.map((comment: Comment) => ({
        ...comment,
        replies: transformedComments.filter((reply: Comment) => reply.parent_id === comment.id)
      }));

      setComments(commentsWithReplies);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [postId, user]);

  const createComment = async (content: string, parentId?: string) => {
    if (!user) {
      toast.error('Vous devez être connecté pour commenter');
      return null;
    }

    if (!content.trim()) {
      toast.error('Le commentaire ne peut pas être vide');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          user_id: user.id,
          post_id: postId,
          content: content.trim(),
          parent_id: parentId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating comment:', error);
        toast.error('Erreur lors de la création du commentaire');
        return null;
      }

      toast.success('Commentaire ajouté avec succès');
      // Refresh comments after successful creation
      await fetchComments();
      return data;
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors de la création du commentaire');
      return null;
    }
  };

  const likeComment = async (commentId: string) => {
    if (!user) {
      toast.error('Vous devez être connecté pour liker un commentaire');
      return;
    }

    try {
      const { data: existingLike } = await supabase
        .from('comment_likes')
        .select('*')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .single();

      if (existingLike) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error unliking comment:', error);
          return;
        }
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: user.id
          });

        if (error) {
          console.error('Error liking comment:', error);
          return;
        }
      }

      await fetchComments();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Charger les commentaires au montage
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Gestion des mises à jour en temps réel
  useEffect(() => {
    if (!postId) return;

    // Nettoyer l'ancien canal s'il existe
    if (channelRef.current) {
      console.log('Cleaning up existing comments channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Créer un nouveau canal avec un identifiant unique
    const sessionId = Math.random().toString(36).substring(2, 15);
    const channelName = `comments_${postId}_${sessionId}`;
    
    console.log('Creating comments channel:', channelName);

    try {
      const channel = supabase.channel(channelName);
      
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`
        },
        () => {
          fetchComments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comment_likes'
        },
        () => {
          fetchComments();
        }
      )
      .subscribe((status: string) => {
        console.log('Comments subscription status:', status);
      });

      channelRef.current = channel;
    } catch (error) {
      console.error('Error setting up comments channel:', error);
    }

    return () => {
      if (channelRef.current) {
        console.log('Unsubscribing from comments channel');
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.error('Error removing comments channel:', error);
        }
        channelRef.current = null;
      }
    };
  }, [postId, fetchComments]);

  return {
    comments,
    loading,
    createComment,
    likeComment,
    refetch: fetchComments
  };
};
