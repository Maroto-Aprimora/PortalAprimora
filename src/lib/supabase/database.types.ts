export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agenda_links: {
        Row: {
          created_at: string
          membro_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          membro_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          membro_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_links_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: true
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          chave: string
          codigo: string | null
          descricao: string | null
          fase_roadmap: number | null
          nome: string
          ordem: number
          prioridade: number | null
          quem_aprova: string | null
          tipo: Database["public"]["Enums"]["tipo_agente"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          chave: string
          codigo?: string | null
          descricao?: string | null
          fase_roadmap?: number | null
          nome: string
          ordem?: number
          prioridade?: number | null
          quem_aprova?: string | null
          tipo: Database["public"]["Enums"]["tipo_agente"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          chave?: string
          codigo?: string | null
          descricao?: string | null
          fase_roadmap?: number | null
          nome?: string
          ordem?: number
          prioridade?: number | null
          quem_aprova?: string | null
          tipo?: Database["public"]["Enums"]["tipo_agente"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agentes_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      anexos: {
        Row: {
          caminho: string
          created_at: string
          enviado_por: string | null
          id: string
          negocio_id: string
          nome: string
          tamanho: number
          tipo_mime: string | null
        }
        Insert: {
          caminho: string
          created_at?: string
          enviado_por?: string | null
          id?: string
          negocio_id: string
          nome: string
          tamanho: number
          tipo_mime?: string | null
        }
        Update: {
          caminho?: string
          created_at?: string
          enviado_por?: string | null
          id?: string
          negocio_id?: string
          nome?: string
          tamanho?: number
          tipo_mime?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anexos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      aprovacoes: {
        Row: {
          agente: string
          comentario: string | null
          conteudo: Json
          conteudo_original: Json | null
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          email_id: string | null
          id: string
          ligacao_id: string | null
          negocio_id: string | null
          responsavel_id: string | null
          resposta_id: string | null
          resumo: string | null
          status: Database["public"]["Enums"]["status_aprovacao"]
          tipo: string
          titulo: string
          trabalho_id: string | null
          updated_at: string
        }
        Insert: {
          agente: string
          comentario?: string | null
          conteudo?: Json
          conteudo_original?: Json | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          email_id?: string | null
          id?: string
          ligacao_id?: string | null
          negocio_id?: string | null
          responsavel_id?: string | null
          resposta_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["status_aprovacao"]
          tipo: string
          titulo: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Update: {
          agente?: string
          comentario?: string | null
          conteudo?: Json
          conteudo_original?: Json | null
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          email_id?: string | null
          id?: string
          ligacao_id?: string | null
          negocio_id?: string | null
          responsavel_id?: string | null
          resposta_id?: string | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["status_aprovacao"]
          tipo?: string
          titulo?: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_agente_fkey"
            columns: ["agente"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["chave"]
          },
          {
            foreignKeyName: "aprovacoes_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_ligacao_id_fkey"
            columns: ["ligacao_id"]
            isOneToOne: false
            referencedRelation: "ligacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "respostas_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      atividade_participantes: {
        Row: {
          atividade_id: string
          membro_id: string
        }
        Insert: {
          atividade_id: string
          membro_id: string
        }
        Update: {
          atividade_id?: string
          membro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividade_participantes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividade_participantes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          confirmada_em: string | null
          created_at: string
          criado_por: string | null
          dia_inteiro: boolean
          diretoria: string | null
          empresa_id: string | null
          fim: string | null
          id: string
          inicio: string
          link_reuniao: string | null
          local: string | null
          negocio_id: string | null
          proximos_passos: string | null
          realizada_em: string | null
          remarcada_de_id: string | null
          remarcada_para_id: string | null
          responsavel_id: string | null
          resumo: string | null
          stakeholder: string | null
          status: Database["public"]["Enums"]["status_atividade"]
          tipo_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          confirmada_em?: string | null
          created_at?: string
          criado_por?: string | null
          dia_inteiro?: boolean
          diretoria?: string | null
          empresa_id?: string | null
          fim?: string | null
          id?: string
          inicio: string
          link_reuniao?: string | null
          local?: string | null
          negocio_id?: string | null
          proximos_passos?: string | null
          realizada_em?: string | null
          remarcada_de_id?: string | null
          remarcada_para_id?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          stakeholder?: string | null
          status?: Database["public"]["Enums"]["status_atividade"]
          tipo_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          confirmada_em?: string | null
          created_at?: string
          criado_por?: string | null
          dia_inteiro?: boolean
          diretoria?: string | null
          empresa_id?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          link_reuniao?: string | null
          local?: string | null
          negocio_id?: string | null
          proximos_passos?: string | null
          realizada_em?: string | null
          remarcada_de_id?: string | null
          remarcada_para_id?: string | null
          responsavel_id?: string | null
          resumo?: string | null
          stakeholder?: string | null
          status?: Database["public"]["Enums"]["status_atividade"]
          tipo_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "atividades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_remarcada_de_id_fkey"
            columns: ["remarcada_de_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_remarcada_para_id_fkey"
            columns: ["remarcada_para_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          autor_id: string | null
          created_at: string
          dados: Json | null
          entidade: string
          entidade_id: string | null
          id: number
        }
        Insert: {
          acao: string
          autor_id?: string | null
          created_at?: string
          dados?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: never
        }
        Update: {
          acao?: string
          autor_id?: string | null
          created_at?: string
          dados?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: never
        }
        Relationships: []
      }
      avaliacoes_ligacao: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          ligacao_id: string
          media: number | null
          membro_id: string
          notas: Json
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          ligacao_id: string
          media?: number | null
          membro_id: string
          notas?: Json
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          ligacao_id?: string
          media?: number | null
          membro_id?: string
          notas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_ligacao_ligacao_id_fkey"
            columns: ["ligacao_id"]
            isOneToOne: true
            referencedRelation: "ligacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_ligacao_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      cadencia_passos: {
        Row: {
          ativo: boolean
          canal: Database["public"]["Enums"]["canal_cadencia"]
          created_at: string
          descricao: string | null
          dia: number
          diretoria: string
          id: string
          so_sem_contato: boolean
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal: Database["public"]["Enums"]["canal_cadencia"]
          created_at?: string
          descricao?: string | null
          dia: number
          diretoria?: string
          id?: string
          so_sem_contato?: boolean
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["canal_cadencia"]
          created_at?: string
          descricao?: string | null
          dia?: number
          diretoria?: string
          id?: string
          so_sem_contato?: boolean
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadencia_passos_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      contatos: {
        Row: {
          cargo: string | null
          created_at: string
          criado_por: string | null
          decisor: boolean
          email: string | null
          empresa_id: string
          id: string
          linkedin: string | null
          nao_contatar: boolean
          nome: string
          observacoes: string | null
          telefone: string | null
          telefone_invalido: boolean
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          criado_por?: string | null
          decisor?: boolean
          email?: string | null
          empresa_id: string
          id?: string
          linkedin?: string | null
          nao_contatar?: boolean
          nome: string
          observacoes?: string | null
          telefone?: string | null
          telefone_invalido?: boolean
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          criado_por?: string | null
          decisor?: boolean
          email?: string | null
          empresa_id?: string
          id?: string
          linkedin?: string | null
          nao_contatar?: boolean
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          telefone_invalido?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contatos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      copies_email: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          diretoria: string
          id: string
          nome: string
          regra: string
          regra_valor: string | null
          updated_at: string
          uso: string
          versao: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          diretoria?: string
          id?: string
          nome: string
          regra?: string
          regra_valor?: string | null
          updated_at?: string
          uso?: string
          versao?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          diretoria?: string
          id?: string
          nome?: string
          regra?: string
          regra_valor?: string | null
          updated_at?: string
          uso?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "copies_email_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copies_email_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      copies_email_mensagens: {
        Row: {
          assunto: string
          copy_id: string
          corpo: string
          id: string
          passo_id: string | null
          updated_at: string
        }
        Insert: {
          assunto?: string
          copy_id: string
          corpo?: string
          id?: string
          passo_id?: string | null
          updated_at?: string
        }
        Update: {
          assunto?: string
          copy_id?: string
          corpo?: string
          id?: string
          passo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copies_email_mensagens_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "copies_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copies_email_mensagens_passo_id_fkey"
            columns: ["passo_id"]
            isOneToOne: false
            referencedRelation: "cadencia_passos"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostico_areas: {
        Row: {
          ativo: boolean
          chave: string
          id: string
          nome: string
          ordem: number
          servico_id: string | null
        }
        Insert: {
          ativo?: boolean
          chave: string
          id?: string
          nome: string
          ordem?: number
          servico_id?: string | null
        }
        Update: {
          ativo?: boolean
          chave?: string
          id?: string
          nome?: string
          ordem?: number
          servico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_areas_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostico_perguntas: {
        Row: {
          area_id: string
          ativo: boolean
          id: string
          ordem: number
          texto: string
        }
        Insert: {
          area_id: string
          ativo?: boolean
          id?: string
          ordem?: number
          texto: string
        }
        Update: {
          area_id?: string
          ativo?: boolean
          id?: string
          ordem?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_perguntas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "diagnostico_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosticos: {
        Row: {
          analise_erro: string | null
          analise_status: string | null
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          criado_por: string | null
          id: string
          maturidade: Json | null
          negocio_id: string
          observacoes: string | null
          realizado_em: string
          respostas: Json
          status: string
          trabalho_id: string | null
          updated_at: string
        }
        Insert: {
          analise_erro?: string | null
          analise_status?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          maturidade?: Json | null
          negocio_id: string
          observacoes?: string | null
          realizado_em?: string
          respostas?: Json
          status?: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Update: {
          analise_erro?: string | null
          analise_status?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          maturidade?: Json | null
          negocio_id?: string
          observacoes?: string | null
          realizado_em?: string
          respostas?: Json
          status?: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      diretorias: {
        Row: {
          ativa: boolean
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativa?: boolean
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativa?: boolean
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          aprovado_por: string | null
          assunto: string
          contato_id: string | null
          copy_id: string | null
          corpo: string
          created_at: string
          d0: string | null
          enviado_em: string | null
          envio_trabalho_id: string | null
          erro: string | null
          gmail_id: string | null
          id: string
          membro_id: string | null
          negocio_id: string
          para: string
          passo_id: string | null
          responder_a: string | null
          status: string
          thread_id: string | null
          trabalho_id: string | null
          updated_at: string
          uso: string
        }
        Insert: {
          aprovado_por?: string | null
          assunto: string
          contato_id?: string | null
          copy_id?: string | null
          corpo: string
          created_at?: string
          d0?: string | null
          enviado_em?: string | null
          envio_trabalho_id?: string | null
          erro?: string | null
          gmail_id?: string | null
          id?: string
          membro_id?: string | null
          negocio_id: string
          para: string
          passo_id?: string | null
          responder_a?: string | null
          status?: string
          thread_id?: string | null
          trabalho_id?: string | null
          updated_at?: string
          uso?: string
        }
        Update: {
          aprovado_por?: string | null
          assunto?: string
          contato_id?: string | null
          copy_id?: string | null
          corpo?: string
          created_at?: string
          d0?: string | null
          enviado_em?: string | null
          envio_trabalho_id?: string | null
          erro?: string | null
          gmail_id?: string | null
          id?: string
          membro_id?: string | null
          negocio_id?: string
          para?: string
          passo_id?: string | null
          responder_a?: string | null
          status?: string
          thread_id?: string | null
          trabalho_id?: string | null
          updated_at?: string
          uso?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "copies_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_envio_trabalho_id_fkey"
            columns: ["envio_trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_passo_id_fkey"
            columns: ["passo_id"]
            isOneToOne: false
            referencedRelation: "cadencia_passos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cidade: string | null
          cnae: string | null
          cnpj: string | null
          cnpj_digitos: string | null
          created_at: string
          criado_por: string | null
          email_principal: string | null
          email_secundario: string | null
          email_terciario: string | null
          endereco: string | null
          enriquecido_em: string | null
          enriquecimento: Json | null
          ficticio: boolean
          id: string
          nome: string
          nome_normalizado: string | null
          observacoes: string | null
          porte: string | null
          razao_social: string | null
          rede_social: string | null
          segmento_id: string | null
          site: string | null
          situacao_cadastral: string | null
          telefone: string | null
          telefone_digitos: string | null
          telefone_invalido: boolean
          uf: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          cnpj_digitos?: string | null
          created_at?: string
          criado_por?: string | null
          email_principal?: string | null
          email_secundario?: string | null
          email_terciario?: string | null
          endereco?: string | null
          enriquecido_em?: string | null
          enriquecimento?: Json | null
          ficticio?: boolean
          id?: string
          nome: string
          nome_normalizado?: string | null
          observacoes?: string | null
          porte?: string | null
          razao_social?: string | null
          rede_social?: string | null
          segmento_id?: string | null
          site?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          telefone_digitos?: string | null
          telefone_invalido?: boolean
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          cnpj_digitos?: string | null
          created_at?: string
          criado_por?: string | null
          email_principal?: string | null
          email_secundario?: string | null
          email_terciario?: string | null
          endereco?: string | null
          enriquecido_em?: string | null
          enriquecimento?: Json | null
          ficticio?: boolean
          id?: string
          nome?: string
          nome_normalizado?: string | null
          observacoes?: string | null
          porte?: string | null
          razao_social?: string | null
          rede_social?: string | null
          segmento_id?: string | null
          site?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          telefone_digitos?: string | null
          telefone_invalido?: boolean
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresas_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_integracoes: {
        Row: {
          erro: string | null
          externo_id: string | null
          id: number
          ligacao_id: string | null
          origem: string
          payload: Json
          processado_em: string | null
          recebido_em: string
        }
        Insert: {
          erro?: string | null
          externo_id?: string | null
          id?: never
          ligacao_id?: string | null
          origem: string
          payload: Json
          processado_em?: string | null
          recebido_em?: string
        }
        Update: {
          erro?: string | null
          externo_id?: string | null
          id?: never
          ligacao_id?: string | null
          origem?: string
          payload?: Json
          processado_em?: string | null
          recebido_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_integracoes_ligacao_id_fkey"
            columns: ["ligacao_id"]
            isOneToOne: false
            referencedRelation: "ligacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      fase_campos: {
        Row: {
          ajuda: string | null
          chave: string
          fase_id: string
          id: string
          obrigatorio: boolean
          opcoes: Json | null
          ordem: number
          rotulo: string
          tipo: Database["public"]["Enums"]["tipo_campo"]
        }
        Insert: {
          ajuda?: string | null
          chave: string
          fase_id: string
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          rotulo: string
          tipo?: Database["public"]["Enums"]["tipo_campo"]
        }
        Update: {
          ajuda?: string | null
          chave?: string
          fase_id?: string
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          rotulo?: string
          tipo?: Database["public"]["Enums"]["tipo_campo"]
        }
        Relationships: [
          {
            foreignKeyName: "fase_campos_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
        ]
      }
      fases: {
        Row: {
          acao_sla: Database["public"]["Enums"]["acao_sla"] | null
          ativa: boolean
          auto_mover_para: string | null
          chave: string
          descricao: string | null
          distribui_responsavel: boolean
          excluida_em: string | null
          exige_motivo: Database["public"]["Enums"]["tipo_motivo"] | null
          fase_destino_sla: string | null
          funil_id: string
          id: string
          macroetapa: Database["public"]["Enums"]["macroetapa"]
          nome: string
          ordem: number
          probabilidade: number
          sla_dias: number | null
          tipo: Database["public"]["Enums"]["tipo_fase"]
        }
        Insert: {
          acao_sla?: Database["public"]["Enums"]["acao_sla"] | null
          ativa?: boolean
          auto_mover_para?: string | null
          chave: string
          descricao?: string | null
          distribui_responsavel?: boolean
          excluida_em?: string | null
          exige_motivo?: Database["public"]["Enums"]["tipo_motivo"] | null
          fase_destino_sla?: string | null
          funil_id: string
          id?: string
          macroetapa: Database["public"]["Enums"]["macroetapa"]
          nome: string
          ordem: number
          probabilidade?: number
          sla_dias?: number | null
          tipo?: Database["public"]["Enums"]["tipo_fase"]
        }
        Update: {
          acao_sla?: Database["public"]["Enums"]["acao_sla"] | null
          ativa?: boolean
          auto_mover_para?: string | null
          chave?: string
          descricao?: string | null
          distribui_responsavel?: boolean
          excluida_em?: string | null
          exige_motivo?: Database["public"]["Enums"]["tipo_motivo"] | null
          fase_destino_sla?: string | null
          funil_id?: string
          id?: string
          macroetapa?: Database["public"]["Enums"]["macroetapa"]
          nome?: string
          ordem?: number
          probabilidade?: number
          sla_dias?: number | null
          tipo?: Database["public"]["Enums"]["tipo_fase"]
        }
        Relationships: [
          {
            foreignKeyName: "fases_auto_mover_para_fkey"
            columns: ["auto_mover_para"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fases_fase_destino_sla_fkey"
            columns: ["fase_destino_sla"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fases_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          created_at: string
          data: string
          nome: string
        }
        Insert: {
          created_at?: string
          data: string
          nome: string
        }
        Update: {
          created_at?: string
          data?: string
          nome?: string
        }
        Relationships: []
      }
      funis: {
        Row: {
          chave: string
          diretoria: string
          id: string
          nome: string
        }
        Insert: {
          chave: string
          diretoria: string
          id?: string
          nome: string
        }
        Update: {
          chave?: string
          diretoria?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "funis_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      ligacoes: {
        Row: {
          api4com_id: string | null
          comentario: string | null
          compromisso_em: string | null
          contato_id: string | null
          created_at: string
          criado_por: string | null
          decisor_melhor_horario: string | null
          decisor_nome: string | null
          duracao_seg: number | null
          gravacao_url: string | null
          id: string
          inicio: string
          membro_id: string
          negocio_id: string
          origem: Database["public"]["Enums"]["origem_registro"]
          proximo_passo: string | null
          resultado_aplicado_em: string | null
          resultado_id: string | null
          resumo: string | null
          retorno_em: string | null
          telefone: string | null
          transcricao: string | null
          updated_at: string
        }
        Insert: {
          api4com_id?: string | null
          comentario?: string | null
          compromisso_em?: string | null
          contato_id?: string | null
          created_at?: string
          criado_por?: string | null
          decisor_melhor_horario?: string | null
          decisor_nome?: string | null
          duracao_seg?: number | null
          gravacao_url?: string | null
          id?: string
          inicio?: string
          membro_id?: string
          negocio_id: string
          origem?: Database["public"]["Enums"]["origem_registro"]
          proximo_passo?: string | null
          resultado_aplicado_em?: string | null
          resultado_id?: string | null
          resumo?: string | null
          retorno_em?: string | null
          telefone?: string | null
          transcricao?: string | null
          updated_at?: string
        }
        Update: {
          api4com_id?: string | null
          comentario?: string | null
          compromisso_em?: string | null
          contato_id?: string | null
          created_at?: string
          criado_por?: string | null
          decisor_melhor_horario?: string | null
          decisor_nome?: string | null
          duracao_seg?: number | null
          gravacao_url?: string | null
          id?: string
          inicio?: string
          membro_id?: string
          negocio_id?: string
          origem?: Database["public"]["Enums"]["origem_registro"]
          proximo_passo?: string | null
          resultado_aplicado_em?: string | null
          resultado_id?: string | null
          resumo?: string | null
          retorno_em?: string | null
          telefone?: string | null
          transcricao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_resultado_id_fkey"
            columns: ["resultado_id"]
            isOneToOne: false
            referencedRelation: "resultados_ligacao"
            referencedColumns: ["id"]
          },
        ]
      }
      membro_diretorias: {
        Row: {
          cargo: Database["public"]["Enums"]["cargo"]
          created_at: string
          diretoria: string
          membro_id: string
          participa_rodizio: boolean
        }
        Insert: {
          cargo: Database["public"]["Enums"]["cargo"]
          created_at?: string
          diretoria: string
          membro_id: string
          participa_rodizio?: boolean
        }
        Update: {
          cargo?: Database["public"]["Enums"]["cargo"]
          created_at?: string
          diretoria?: string
          membro_id?: string
          participa_rodizio?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "membro_diretorias_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "membro_diretorias_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      membros: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          data_entrada: string | null
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          data_entrada?: string | null
          email: string
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          data_entrada?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      metas: {
        Row: {
          alvo: number
          codigo: string | null
          created_at: string
          diretoria: string
          id: string
          indicador: string | null
          membro_id: string | null
          objetivo: string
          ordem: number
          peso: number
          realizado_manual: number | null
          titulo: string
          trimestre: string
          unidade: string
        }
        Insert: {
          alvo: number
          codigo?: string | null
          created_at?: string
          diretoria: string
          id?: string
          indicador?: string | null
          membro_id?: string | null
          objetivo: string
          ordem?: number
          peso?: number
          realizado_manual?: number | null
          titulo: string
          trimestre: string
          unidade?: string
        }
        Update: {
          alvo?: number
          codigo?: string | null
          created_at?: string
          diretoria?: string
          id?: string
          indicador?: string | null
          membro_id?: string | null
          objetivo?: string
          ordem?: number
          peso?: number
          realizado_manual?: number | null
          titulo?: string
          trimestre?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "metas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos: {
        Row: {
          ativo: boolean
          chave: string | null
          diretoria: string
          exige_comentario: boolean
          id: string
          marca_nao_contatar: boolean
          nome: string
          ordem: number
          tipo: Database["public"]["Enums"]["tipo_motivo"]
        }
        Insert: {
          ativo?: boolean
          chave?: string | null
          diretoria?: string
          exige_comentario?: boolean
          id?: string
          marca_nao_contatar?: boolean
          nome: string
          ordem?: number
          tipo: Database["public"]["Enums"]["tipo_motivo"]
        }
        Update: {
          ativo?: boolean
          chave?: string | null
          diretoria?: string
          exige_comentario?: boolean
          id?: string
          marca_nao_contatar?: boolean
          nome?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["tipo_motivo"]
        }
        Relationships: [
          {
            foreignKeyName: "motivos_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      negocio_historico: {
        Row: {
          automatico: boolean
          autor_id: string | null
          comentario: string | null
          created_at: string
          fase_destino_id: string
          fase_origem_id: string | null
          id: number
          motivo_id: string | null
          negocio_id: string
          responsavel_id: string | null
        }
        Insert: {
          automatico?: boolean
          autor_id?: string | null
          comentario?: string | null
          created_at?: string
          fase_destino_id: string
          fase_origem_id?: string | null
          id?: never
          motivo_id?: string | null
          negocio_id: string
          responsavel_id?: string | null
        }
        Update: {
          automatico?: boolean
          autor_id?: string | null
          comentario?: string | null
          created_at?: string
          fase_destino_id?: string
          fase_origem_id?: string | null
          id?: never
          motivo_id?: string | null
          negocio_id?: string
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocio_historico_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_historico_fase_destino_id_fkey"
            columns: ["fase_destino_id"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_historico_fase_origem_id_fkey"
            columns: ["fase_origem_id"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_historico_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "motivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_historico_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_historico_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio_participantes: {
        Row: {
          membro_id: string
          negocio_id: string
          papel: string | null
        }
        Insert: {
          membro_id: string
          negocio_id: string
          papel?: string | null
        }
        Update: {
          membro_id?: string
          negocio_id?: string
          papel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocio_participantes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_participantes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      negocio_servicos: {
        Row: {
          negocio_id: string
          servico_id: string
          valor: number | null
        }
        Insert: {
          negocio_id: string
          servico_id: string
          valor?: number | null
        }
        Update: {
          negocio_id?: string
          servico_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocio_servicos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocio_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          campos: Json
          contato_id: string | null
          created_at: string
          criado_por: string | null
          data_coldcall_1: string | null
          data_coldcall_2: string | null
          dores_identificadas: string | null
          empresa_id: string
          encerrado_em: string | null
          entrou_na_fase_em: string
          fase_id: string
          ficticio: boolean
          funil_id: string
          ganho_em: string | null
          id: string
          motivo_detalhe: string | null
          motivo_id: string | null
          origem_detalhe: string | null
          origem_id: string | null
          responsavel_id: string | null
          retorno_em: string | null
          titulo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          campos?: Json
          contato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_coldcall_1?: string | null
          data_coldcall_2?: string | null
          dores_identificadas?: string | null
          empresa_id: string
          encerrado_em?: string | null
          entrou_na_fase_em?: string
          fase_id: string
          ficticio?: boolean
          funil_id: string
          ganho_em?: string | null
          id?: string
          motivo_detalhe?: string | null
          motivo_id?: string | null
          origem_detalhe?: string | null
          origem_id?: string | null
          responsavel_id?: string | null
          retorno_em?: string | null
          titulo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          campos?: Json
          contato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_coldcall_1?: string | null
          data_coldcall_2?: string | null
          dores_identificadas?: string | null
          empresa_id?: string
          encerrado_em?: string | null
          entrou_na_fase_em?: string
          fase_id?: string
          ficticio?: boolean
          funil_id?: string
          ganho_em?: string | null
          id?: string
          motivo_detalhe?: string | null
          motivo_id?: string | null
          origem_detalhe?: string | null
          origem_id?: string | null
          responsavel_id?: string | null
          retorno_em?: string | null
          titulo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "motivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "origens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          chave: string | null
          created_at: string
          id: string
          lida_em: string | null
          link: string | null
          membro_id: string
          mensagem: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          chave?: string | null
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          membro_id: string
          mensagem?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          chave?: string | null
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          membro_id?: string
          mensagem?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          chave: string | null
          created_at: string
          detalhes: Json
          id: string
          link: string | null
          mensagem: string | null
          origem: string | null
          resolvida_em: string | null
          resolvida_por: string | null
          tipo: string
          titulo: string
          ultima_em: string
          vezes: number
        }
        Insert: {
          chave?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          link?: string | null
          mensagem?: string | null
          origem?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          tipo: string
          titulo: string
          ultima_em?: string
          vezes?: number
        }
        Update: {
          chave?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          link?: string | null
          mensagem?: string | null
          origem?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          tipo?: string
          titulo?: string
          ultima_em?: string
          vezes?: number
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_resolvida_por_fkey"
            columns: ["resolvida_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      origens: {
        Row: {
          ativo: boolean
          chave: string | null
          diretoria: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          chave?: string | null
          diretoria?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          chave?: string | null
          diretoria?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "origens_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      parametros_comercial: {
        Row: {
          cadencia_dias_reciclagem: number
          diretoria: string
          envio_hora_fim: number
          envio_hora_inicio: number
          follow_up_proposta_dias: number
          reciclagem_retorno_dias: number
          remetente_nome: string
          updated_at: string
        }
        Insert: {
          cadencia_dias_reciclagem?: number
          diretoria: string
          envio_hora_fim?: number
          envio_hora_inicio?: number
          follow_up_proposta_dias?: number
          reciclagem_retorno_dias?: number
          remetente_nome?: string
          updated_at?: string
        }
        Update: {
          cadencia_dias_reciclagem?: number
          diretoria?: string
          envio_hora_fim?: number
          envio_hora_inicio?: number
          follow_up_proposta_dias?: number
          reciclagem_retorno_dias?: number
          remetente_nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parametros_comercial_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: true
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      parametros_precificacao: {
        Row: {
          diretoria: string
          fatores: Json
          imposto: number
          margem_maxima: number
          margem_minima: number
          updated_at: string
          valor_hora_consultor: number
          valor_hora_gerente: number
        }
        Insert: {
          diretoria: string
          fatores?: Json
          imposto?: number
          margem_maxima?: number
          margem_minima?: number
          updated_at?: string
          valor_hora_consultor?: number
          valor_hora_gerente?: number
        }
        Update: {
          diretoria?: string
          fatores?: Json
          imposto?: number
          margem_maxima?: number
          margem_minima?: number
          updated_at?: string
          valor_hora_consultor?: number
          valor_hora_gerente?: number
        }
        Relationships: [
          {
            foreignKeyName: "parametros_precificacao_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: true
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      pontuacoes: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          created_at: string
          criado_por: string | null
          data: string
          id: string
          membro_id: string
          motivo: string
          pontos: number
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          created_at?: string
          criado_por?: string | null
          data?: string
          id?: string
          membro_id: string
          motivo: string
          pontos: number
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          created_at?: string
          criado_por?: string | null
          data?: string
          id?: string
          membro_id?: string
          motivo?: string
          pontos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pontuacoes_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_cadastro_diretorias: {
        Row: {
          cargo: Database["public"]["Enums"]["cargo"]
          diretoria: string
          pre_cadastro_id: string
        }
        Insert: {
          cargo: Database["public"]["Enums"]["cargo"]
          diretoria: string
          pre_cadastro_id: string
        }
        Update: {
          cargo?: Database["public"]["Enums"]["cargo"]
          diretoria?: string
          pre_cadastro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_cadastro_diretorias_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "pre_cadastro_diretorias_pre_cadastro_id_fkey"
            columns: ["pre_cadastro_id"]
            isOneToOne: false
            referencedRelation: "pre_cadastros"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_cadastros: {
        Row: {
          aceito_em: string | null
          convite_enviado_em: string | null
          created_at: string
          criado_por: string | null
          data_entrada: string | null
          email: string
          id: string
          nome: string
        }
        Insert: {
          aceito_em?: string | null
          convite_enviado_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_entrada?: string | null
          email: string
          id?: string
          nome: string
        }
        Update: {
          aceito_em?: string | null
          convite_enviado_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_entrada?: string | null
          email?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_cadastros_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      precificacoes: {
        Row: {
          atualizado_por: string | null
          created_at: string
          custo_base: number | null
          custos: Json
          definido_em: string | null
          definido_por: string | null
          fatores: Json
          horas_consultor: number
          horas_gerente: number
          id: string
          multiplicador: number | null
          negocio_id: string
          observacoes: string | null
          preco_final: number | null
          preco_maximo: number | null
          preco_minimo: number | null
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          created_at?: string
          custo_base?: number | null
          custos?: Json
          definido_em?: string | null
          definido_por?: string | null
          fatores?: Json
          horas_consultor?: number
          horas_gerente?: number
          id?: string
          multiplicador?: number | null
          negocio_id: string
          observacoes?: string | null
          preco_final?: number | null
          preco_maximo?: number | null
          preco_minimo?: number | null
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          created_at?: string
          custo_base?: number | null
          custos?: Json
          definido_em?: string | null
          definido_por?: string | null
          fatores?: Json
          horas_consultor?: number
          horas_gerente?: number
          id?: string
          multiplicador?: number | null
          negocio_id?: string
          observacoes?: string | null
          preco_final?: number | null
          preco_maximo?: number | null
          preco_minimo?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "precificacoes_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precificacoes_definido_por_fkey"
            columns: ["definido_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precificacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_seletivos: {
        Row: {
          created_at: string
          data: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      propostas: {
        Row: {
          created_at: string
          diagnostico_id: string | null
          escopo: string | null
          gerado_em: string | null
          id: string
          negocio_id: string
          resumo_diagnostico: string | null
          revisado_em: string | null
          revisado_por: string | null
          servicos_sugeridos: Json
          status: string
          texto: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          diagnostico_id?: string | null
          escopo?: string | null
          gerado_em?: string | null
          id?: string
          negocio_id: string
          resumo_diagnostico?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          servicos_sugeridos?: Json
          status?: string
          texto?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          diagnostico_id?: string | null
          escopo?: string | null
          gerado_em?: string | null
          id?: string
          negocio_id?: string
          resumo_diagnostico?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          servicos_sugeridos?: Json
          status?: string
          texto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "propostas_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "diagnosticos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: true
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      push_assinaturas: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          membro_id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          membro_id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          membro_id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_assinaturas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios: {
        Row: {
          analise: Json | null
          ate: string
          created_at: string
          criado_por: string | null
          dados: Json
          de: string
          erro: string | null
          id: string
          revisado_em: string | null
          revisado_por: string | null
          status: Database["public"]["Enums"]["status_relatorio"]
          texto_revisado: string | null
          tipo: string
          trabalho_id: string | null
          updated_at: string
        }
        Insert: {
          analise?: Json | null
          ate: string
          created_at?: string
          criado_por?: string | null
          dados: Json
          de: string
          erro?: string | null
          id?: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["status_relatorio"]
          texto_revisado?: string | null
          tipo?: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Update: {
          analise?: Json | null
          ate?: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          de?: string
          erro?: string | null
          id?: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["status_relatorio"]
          texto_revisado?: string | null
          tipo?: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_email: {
        Row: {
          aplicada_em: string | null
          assunto: string | null
          classificacao: string | null
          created_at: string
          de: string | null
          email_id: string | null
          gmail_id: string
          id: string
          negocio_id: string
          recebido_em: string
          resumo: string | null
          retorno_em: string | null
          thread_id: string | null
          trecho: string | null
        }
        Insert: {
          aplicada_em?: string | null
          assunto?: string | null
          classificacao?: string | null
          created_at?: string
          de?: string | null
          email_id?: string | null
          gmail_id: string
          id?: string
          negocio_id: string
          recebido_em?: string
          resumo?: string | null
          retorno_em?: string | null
          thread_id?: string | null
          trecho?: string | null
        }
        Update: {
          aplicada_em?: string | null
          assunto?: string | null
          classificacao?: string | null
          created_at?: string
          de?: string | null
          email_id?: string | null
          gmail_id?: string
          id?: string
          negocio_id?: string
          recebido_em?: string
          resumo?: string | null
          retorno_em?: string | null
          thread_id?: string | null
          trecho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_email_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_email_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_ligacao: {
        Row: {
          ativo: boolean
          chave: string
          conta_tentativa: boolean
          created_at: string
          descricao: string | null
          diretoria: string
          exige_retorno: boolean
          fase_destino_id: string | null
          id: string
          marca_telefone_invalido: boolean
          motivo_id: string | null
          nome: string
          ordem: number
          registra_decisor: boolean
          tarefa_prazo: Database["public"]["Enums"]["prazo_tarefa_auto"] | null
          tarefa_titulo: string | null
          tipo_atividade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          conta_tentativa?: boolean
          created_at?: string
          descricao?: string | null
          diretoria?: string
          exige_retorno?: boolean
          fase_destino_id?: string | null
          id?: string
          marca_telefone_invalido?: boolean
          motivo_id?: string | null
          nome: string
          ordem?: number
          registra_decisor?: boolean
          tarefa_prazo?: Database["public"]["Enums"]["prazo_tarefa_auto"] | null
          tarefa_titulo?: string | null
          tipo_atividade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          conta_tentativa?: boolean
          created_at?: string
          descricao?: string | null
          diretoria?: string
          exige_retorno?: boolean
          fase_destino_id?: string | null
          id?: string
          marca_telefone_invalido?: boolean
          motivo_id?: string | null
          nome?: string
          ordem?: number
          registra_decisor?: boolean
          tarefa_prazo?: Database["public"]["Enums"]["prazo_tarefa_auto"] | null
          tarefa_titulo?: string | null
          tipo_atividade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resultados_ligacao_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "resultados_ligacao_fase_destino_id_fkey"
            columns: ["fase_destino_id"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_ligacao_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "motivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_ligacao_tipo_atividade_id_fkey"
            columns: ["tipo_atividade_id"]
            isOneToOne: false
            referencedRelation: "tipos_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      reunioes_recorrentes: {
        Row: {
          ativa: boolean
          created_at: string
          dia_semana: number
          diretoria: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          local: string | null
          tipo_id: string
          titulo: string
          valida_ate: string | null
          valida_de: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          dia_semana: number
          diretoria?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          local?: string | null
          tipo_id: string
          titulo: string
          valida_ate?: string | null
          valida_de?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          dia_semana?: number
          diretoria?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          local?: string | null
          tipo_id?: string
          titulo?: string
          valida_ate?: string | null
          valida_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "reunioes_recorrentes_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "reunioes_recorrentes_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      rodizio_estado: {
        Row: {
          atualizado_em: string
          funil_id: string
          ultimo_membro_id: string | null
        }
        Insert: {
          atualizado_em?: string
          funil_id: string
          ultimo_membro_id?: string | null
        }
        Update: {
          atualizado_em?: string
          funil_id?: string
          ultimo_membro_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rodizio_estado_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: true
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rodizio_estado_ultimo_membro_id_fkey"
            columns: ["ultimo_membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrica_criterios: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          descricao: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          descricao: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          descricao?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      segmentos: {
        Row: {
          ativo: boolean
          diretoria: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          diretoria?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          diretoria?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "segmentos_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      servicos: {
        Row: {
          area: Database["public"]["Enums"]["area_servico"]
          ativo: boolean
          descricao: string | null
          diretoria: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          area: Database["public"]["Enums"]["area_servico"]
          ativo?: boolean
          descricao?: string | null
          diretoria?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          area?: Database["public"]["Enums"]["area_servico"]
          ativo?: boolean
          descricao?: string | null
          diretoria?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "servicos_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      stockfacil_buscas: {
        Row: {
          cidade: string
          concluida_em: string | null
          created_at: string
          criado_por: string | null
          encontrados: number | null
          erro: string | null
          id: string
          novos: number | null
          status: string
          termos: string[]
          trabalho_id: string | null
        }
        Insert: {
          cidade?: string
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          encontrados?: number | null
          erro?: string | null
          id?: string
          novos?: number | null
          status?: string
          termos: string[]
          trabalho_id?: string | null
        }
        Update: {
          cidade?: string
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          encontrados?: number | null
          erro?: string | null
          id?: string
          novos?: number | null
          status?: string
          termos?: string[]
          trabalho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stockfacil_buscas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockfacil_buscas_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "trabalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      stockfacil_leads: {
        Row: {
          atualizado_por: string | null
          avaliacoes: number | null
          bairro: string | null
          busca_id: string | null
          categoria: string | null
          created_at: string
          emails: string | null
          endereco: string | null
          id: string
          latitude: number | null
          link_maps: string | null
          longitude: number | null
          nome: string
          nota: number | null
          observacoes: string | null
          place_id: string | null
          responsavel_id: string | null
          site: string | null
          situacao: string
          telefone: string | null
          telefone_digitos: string | null
          termo: string | null
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          avaliacoes?: number | null
          bairro?: string | null
          busca_id?: string | null
          categoria?: string | null
          created_at?: string
          emails?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          link_maps?: string | null
          longitude?: number | null
          nome: string
          nota?: number | null
          observacoes?: string | null
          place_id?: string | null
          responsavel_id?: string | null
          site?: string | null
          situacao?: string
          telefone?: string | null
          telefone_digitos?: string | null
          termo?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          avaliacoes?: number | null
          bairro?: string | null
          busca_id?: string | null
          categoria?: string | null
          created_at?: string
          emails?: string | null
          endereco?: string | null
          id?: string
          latitude?: number | null
          link_maps?: string | null
          longitude?: number | null
          nome?: string
          nota?: number | null
          observacoes?: string | null
          place_id?: string | null
          responsavel_id?: string | null
          site?: string | null
          situacao?: string
          telefone?: string | null
          telefone_digitos?: string | null
          termo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stockfacil_leads_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockfacil_leads_busca_id_fkey"
            columns: ["busca_id"]
            isOneToOne: false
            referencedRelation: "stockfacil_buscas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stockfacil_leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_responsaveis: {
        Row: {
          membro_id: string
          tarefa_id: string
        }
        Insert: {
          membro_id: string
          tarefa_id: string
        }
        Update: {
          membro_id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_responsaveis_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_responsaveis_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          atividade_id: string | null
          chave: string | null
          concluida_em: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          diretoria: string
          id: string
          negocio_id: string | null
          origem: Database["public"]["Enums"]["origem_registro"]
          prazo: string | null
          prioridade: Database["public"]["Enums"]["prioridade"]
          status: Database["public"]["Enums"]["status_tarefa"]
          titulo: string
          updated_at: string
        }
        Insert: {
          atividade_id?: string | null
          chave?: string | null
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          diretoria: string
          id?: string
          negocio_id?: string | null
          origem?: Database["public"]["Enums"]["origem_registro"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade"]
          status?: Database["public"]["Enums"]["status_tarefa"]
          titulo: string
          updated_at?: string
        }
        Update: {
          atividade_id?: string | null
          chave?: string | null
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          diretoria?: string
          id?: string
          negocio_id?: string | null
          origem?: Database["public"]["Enums"]["origem_registro"]
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade"]
          status?: Database["public"]["Enums"]["status_tarefa"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_atividade: {
        Row: {
          ativo: boolean
          chave: string
          cor: string
          diretoria: string | null
          exige_confirmacao: boolean
          id: string
          ligada_a_lead: boolean
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          chave: string
          cor?: string
          diretoria?: string | null
          exige_confirmacao?: boolean
          id?: string
          ligada_a_lead?: boolean
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          chave?: string
          cor?: string
          diretoria?: string | null
          exige_confirmacao?: boolean
          id?: string
          ligada_a_lead?: boolean
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "tipos_atividade_diretoria_fkey"
            columns: ["diretoria"]
            isOneToOne: false
            referencedRelation: "diretorias"
            referencedColumns: ["slug"]
          },
        ]
      }
      trabalhos: {
        Row: {
          agente: string
          chave: string | null
          concluido_em: string | null
          created_at: string
          criado_por: string | null
          erro: string | null
          id: string
          max_tentativas: number
          negocio_id: string | null
          payload: Json
          proximo_em: string
          reservado_em: string | null
          resultado: Json | null
          status: Database["public"]["Enums"]["status_trabalho"]
          tentativas: number
          tipo: string
          updated_at: string
        }
        Insert: {
          agente: string
          chave?: string | null
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          erro?: string | null
          id?: string
          max_tentativas?: number
          negocio_id?: string | null
          payload?: Json
          proximo_em?: string
          reservado_em?: string | null
          resultado?: Json | null
          status?: Database["public"]["Enums"]["status_trabalho"]
          tentativas?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          agente?: string
          chave?: string | null
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          erro?: string | null
          id?: string
          max_tentativas?: number
          negocio_id?: string | null
          payload?: Json
          proximo_em?: string
          reservado_em?: string | null
          resultado?: Json | null
          status?: Database["public"]["Enums"]["status_trabalho"]
          tentativas?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabalhos_agente_fkey"
            columns: ["agente"]
            isOneToOne: false
            referencedRelation: "agentes"
            referencedColumns: ["chave"]
          },
          {
            foreignKeyName: "trabalhos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabalhos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agenda_do_link: { Args: { _token: string }; Returns: Json }
      buscar_leads_stockfacil: {
        Args: { _cidade?: string; _termos: string[] }
        Returns: string
      }
      concluir_diagnostico: { Args: { _diagnostico: string }; Returns: Json }
      empresas_semelhantes: {
        Args: {
          _cnpj?: string
          _dominio?: string
          _nome: string
          _telefone?: string
        }
        Returns: {
          cidade: string
          cnpj: string
          id: string
          motivo: string
          nome: string
          semelhanca: number
        }[]
      }
      enriquecer_negocio: { Args: { _negocio: string }; Returns: string }
      enviar_trabalho_teste: { Args: never; Returns: string }
      excluir_fase: {
        Args: { _destino?: string; _fase: string }
        Returns: Json
      }
      gerar_link_agenda: { Args: never; Returns: string }
      gerar_relatorio_ri: {
        Args: { _ate?: string; _de?: string }
        Returns: string
      }
      indicadores_comerciais: {
        Args: { _ate: string; _de: string; _responsavel?: string }
        Returns: Json
      }
      indicadores_email: {
        Args: { _ate: string; _de: string; _responsavel?: string }
        Returns: Json
      }
      mover_negocio: {
        Args: {
          _comentario?: string
          _fase: string
          _motivo?: string
          _motivo_detalhe?: string
          _negocio: string
          _retorno_em?: string
        }
        Returns: undefined
      }
      n8n_alerta: {
        Args: { _detalhes?: Json; _segredo: string; _tipo: string }
        Returns: Json
      }
      n8n_concluir: {
        Args: { _id: string; _resultado?: Json; _segredo: string }
        Returns: Json
      }
      n8n_erro: {
        Args: {
          _execucao_id?: string
          _execucao_url?: string
          _fluxo: string
          _mensagem?: string
          _no?: string
          _segredo: string
        }
        Returns: Json
      }
      n8n_falhar: {
        Args: {
          _etapa?: string
          _id: string
          _mensagem?: string
          _segredo: string
        }
        Returns: Json
      }
      n8n_registrar_chamadas: {
        Args: { _chamadas: Json; _segredo: string }
        Returns: Json
      }
      n8n_registrar_respostas: {
        Args: { _mensagens: Json; _segredo: string }
        Returns: Json
      }
      n8n_reservar: {
        Args: { _agente?: string; _limite?: number; _segredo: string }
        Returns: Json
      }
      n8n_saude: { Args: { _segredo: string }; Returns: Json }
      n8n_stockfacil_iniciada: {
        Args: { _busca: string; _segredo: string }
        Returns: undefined
      }
      normalizar: { Args: { _t: string }; Returns: string }
      plano_melhoria: { Args: { _membro: string }; Returns: Json }
      reabrir_diagnostico: {
        Args: { _diagnostico: string }
        Returns: undefined
      }
      registrar_erro_app: {
        Args: { _caminho?: string; _codigo?: string; _mensagem: string }
        Returns: undefined
      }
      registrar_evento_integracao: {
        Args: { _origem: string; _payload: Json; _token: string }
        Returns: Json
      }
      remarcar_atividade: {
        Args: {
          _atividade: string
          _motivo?: string
          _novo_fim?: string
          _novo_inicio: string
        }
        Returns: string
      }
      saude_fila: { Args: never; Returns: Json }
      so_digitos: { Args: { _t: string }; Returns: string }
      transferir_carteira: {
        Args: { _de: string; _diretoria: string; _para: string }
        Returns: Json
      }
      valor_indicador_meta: {
        Args: { _ate: string; _chave: string; _de: string; _membro?: string }
        Returns: number
      }
    }
    Enums: {
      acao_sla: "alertar" | "mover"
      area_servico: "negocios" | "producao" | "qualidade"
      canal_cadencia: "email" | "ligacao"
      cargo: "diretor" | "assessor" | "trainee"
      macroetapa:
        | "prospeccao"
        | "cadencia"
        | "oportunidade"
        | "venda"
        | "ganho"
        | "pausa"
        | "perda"
      origem_registro: "manual" | "sistema" | "agente"
      prazo_tarefa_auto:
        | "mesmo_dia"
        | "proximo_dia_util"
        | "proximo_toque"
        | "data_retorno"
        | "vespera_compromisso"
      prioridade: "baixa" | "media" | "alta"
      status_aprovacao: "pendente" | "aprovada" | "descartada"
      status_atividade:
        | "pendente"
        | "confirmada"
        | "realizada"
        | "remarcada"
        | "cancelada"
      status_relatorio: "gerando" | "pronto" | "erro"
      status_tarefa: "pendente" | "em_andamento" | "concluida"
      status_trabalho:
        | "pendente"
        | "processando"
        | "concluido"
        | "erro"
        | "cancelado"
      tipo_agente: "ia" | "regra" | "regra_ia" | "sistema"
      tipo_campo:
        | "texto"
        | "texto_longo"
        | "data"
        | "numero"
        | "moeda"
        | "membros"
        | "selecao"
        | "booleano"
        | "link"
      tipo_fase: "aberta" | "ganho" | "perda" | "pausa"
      tipo_motivo: "perda" | "desqualificacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acao_sla: ["alertar", "mover"],
      area_servico: ["negocios", "producao", "qualidade"],
      canal_cadencia: ["email", "ligacao"],
      cargo: ["diretor", "assessor", "trainee"],
      macroetapa: [
        "prospeccao",
        "cadencia",
        "oportunidade",
        "venda",
        "ganho",
        "pausa",
        "perda",
      ],
      origem_registro: ["manual", "sistema", "agente"],
      prazo_tarefa_auto: [
        "mesmo_dia",
        "proximo_dia_util",
        "proximo_toque",
        "data_retorno",
        "vespera_compromisso",
      ],
      prioridade: ["baixa", "media", "alta"],
      status_aprovacao: ["pendente", "aprovada", "descartada"],
      status_atividade: [
        "pendente",
        "confirmada",
        "realizada",
        "remarcada",
        "cancelada",
      ],
      status_relatorio: ["gerando", "pronto", "erro"],
      status_tarefa: ["pendente", "em_andamento", "concluida"],
      status_trabalho: [
        "pendente",
        "processando",
        "concluido",
        "erro",
        "cancelado",
      ],
      tipo_agente: ["ia", "regra", "regra_ia", "sistema"],
      tipo_campo: [
        "texto",
        "texto_longo",
        "data",
        "numero",
        "moeda",
        "membros",
        "selecao",
        "booleano",
        "link",
      ],
      tipo_fase: ["aberta", "ganho", "perda", "pausa"],
      tipo_motivo: ["perda", "desqualificacao"],
    },
  },
} as const
